const crypto = require('crypto');
const pool = require('../db');

class WebhookService {
  /**
   * Verify Meta Webhook HMAC SHA-256 Signature
   */
  static verifySignature(rawBody, signatureHeader, appSecret) {
    if (!signatureHeader || !appSecret) return true; // Skip if app secret not configured in dev
    const [algorithm, signature] = signatureHeader.split('=');
    if (algorithm !== 'sha256') return false;

    const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  /**
   * Process raw Webhook Event asynchronously
   */
  static async processEvent(payload) {
    try {
      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      if (!value) return;

      const organizationId = 1; // Default tenant

      // 1. Process Incoming Customer Messages
      if (value.messages && value.messages.length > 0) {
        for (const msg of value.messages) {
          const eventId = msg.id;

          // Check Idempotency
          const dupCheck = await pool.query(`SELECT id FROM webhook_events WHERE event_id = $1`, [eventId]);
          if (dupCheck.rows.length > 0) continue; // Already processed

          await pool.query(
            `INSERT INTO webhook_events (event_id, payload, processed) VALUES ($1, $2, TRUE)`,
            [eventId, JSON.stringify(msg)]
          );

          const waNumber = msg.from;
          const contactName = value.contacts?.[0]?.profile?.name || null;

          let msgType = msg.type || 'text';
          let body = msg.text?.body || '';
          let mediaUrl = null;

          if (msgType === 'image') body = msg.image?.caption || '[Image Message]';
          else if (msgType === 'video') body = msg.video?.caption || '[Video Message]';
          else if (msgType === 'document') body = msg.document?.caption || `[Document: ${msg.document?.filename || 'File'}]`;
          else if (msgType === 'audio') body = '[Voice Message]';
          else if (msgType === 'location') body = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
          else if (!body) body = `[${msgType} message]`;

          // Upsert contact record & refresh last_message_at (resets 24h customer window)
          const contactRes = await pool.query(
            `INSERT INTO contacts (organization_id, wa_number, name, last_message_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (organization_id, wa_number) DO UPDATE SET
               last_message_at = NOW(),
               name = COALESCE(contacts.name, EXCLUDED.name),
               updated_at = NOW()
             RETURNING *`,
            [organizationId, waNumber, contactName]
          );

          const contact = contactRes.rows[0];

          // Upsert conversation record
          const convRes = await pool.query(
            `INSERT INTO conversations (organization_id, contact_id, status, unread_count, last_message_preview, last_message_at)
             VALUES ($1, $2, 'open', 1, $3, NOW())
             ON CONFLICT (contact_id) DO UPDATE SET
               status = 'open',
               unread_count = conversations.unread_count + 1,
               last_message_preview = EXCLUDED.last_message_preview,
               last_message_at = NOW()
             RETURNING id`,
            [organizationId, contact.id, body]
          );

          const conversationId = convRes.rows[0].id;

          // Insert inbound message record
          await pool.query(
            `INSERT INTO messages (
               organization_id, contact_id, conversation_id, direction, type, body, media_url, wa_message_id, status
             ) VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, 'received')`,
            [organizationId, contact.id, conversationId, msgType, body, mediaUrl, msg.id]
          );
        }
      }

      // 2. Process Outbound Message Status Callbacks (sent -> delivered -> read -> failed)
      if (value.statuses && value.statuses.length > 0) {
        for (const statusObj of value.statuses) {
          const waMessageId = statusObj.id;
          const status = statusObj.status; // sent, delivered, read, failed
          const errors = statusObj.errors?.[0];

          // Update message record
          const updateRes = await pool.query(
            `UPDATE messages SET
               status = $1,
               error_code = $2,
               error_message = $3
             WHERE wa_message_id = $4 RETURNING campaign_id, id`,
            [status, errors?.code ? String(errors.code) : null, errors?.title || errors?.message || null, waMessageId]
          );

          // Update campaign stats if this message belonged to a campaign
          if (updateRes.rows.length > 0) {
            const campaignId = updateRes.rows[0].campaign_id;
            if (campaignId) {
              if (status === 'delivered') {
                await pool.query(`UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = $1`, [campaignId]);
              } else if (status === 'read') {
                await pool.query(`UPDATE campaigns SET read_count = read_count + 1 WHERE id = $1`, [campaignId]);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error processing Webhook event:', err);
    }
  }
}

module.exports = WebhookService;
