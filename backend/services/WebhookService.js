const crypto = require('crypto');
const pool = require('../db');
const WhatsAppService = require('./WhatsAppService');
const TemplateService = require('./TemplateService');

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
   * Send Opt-Out Confirmation Reply via Template or Text Fallback
   */
  static async sendOptOutReply(organizationId, contact, conversationId) {
    try {
      await TemplateService.ensureSchema();
      // Search DB for an approved opt-out reply template
      const tRes = await pool.query(
        `SELECT * FROM templates 
         WHERE organization_id = $1 
           AND status = 'APPROVED'
           AND (name ILIKE '%opt_out%' OR name ILIKE '%stop%' OR name ILIKE '%unsubscribe%' OR name ILIKE '%optout%')
         LIMIT 1`,
        [organizationId]
      );

      const template = tRes.rows[0];
      let waMessageId = null;
      let replyBody = '';
      let templateName = null;
      let templateParams = null;

      if (template) {
        templateName = template.name;
        const metaComponents = TemplateService.buildPayloadComponents(
          template.components || [],
          template.default_parameter_mapping || {},
          contact
        );
        const waRes = await WhatsAppService.sendTemplate(
          organizationId,
          contact.wa_number,
          template.name,
          template.language,
          metaComponents
        );
        waMessageId = waRes.messages?.[0]?.id;
        replyBody = `[Opt-Out Template: ${template.name}]`;
        templateParams = JSON.stringify(metaComponents);
      } else {
        replyBody = 'You have been unsubscribed and will no longer receive broadcast messages. Send any message to opt back in.';
        const waRes = await WhatsAppService.sendText(organizationId, contact.wa_number, replyBody);
        waMessageId = waRes.messages?.[0]?.id;
      }

      // Log outbound opt-out message
      await pool.query(
        `INSERT INTO messages (
           organization_id, contact_id, conversation_id, direction, type, body, template_name, template_params, wa_message_id, status
         ) VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, 'sent')`,
        [
          organizationId,
          contact.id,
          conversationId,
          templateName ? 'template' : 'text',
          replyBody,
          templateName,
          templateParams,
          waMessageId,
        ]
      );

      // Update conversation preview
      await pool.query(
        `UPDATE conversations SET last_message_preview = $1, last_message_at = NOW() WHERE id = $2`,
        [replyBody, conversationId]
      );
    } catch (err) {
      console.error('Error sending opt-out reply:', err?.response?.data || err.message);
    }
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
          const profileName = value.contacts?.[0]?.profile?.name || null;

          let msgType = msg.type || 'text';
          let body = msg.text?.body || '';
          let mediaUrl = null;

          if (msgType === 'image') body = msg.image?.caption || '[Image Message]';
          else if (msgType === 'video') body = msg.video?.caption || '[Video Message]';
          else if (msgType === 'document') body = msg.document?.caption || `[Document: ${msg.document?.filename || 'File'}]`;
          else if (msgType === 'audio') body = '[Voice Message]';
          else if (msgType === 'location') body = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
          else if (msgType === 'button') body = msg.button?.text || '[Button Click]';
          else if (msgType === 'interactive') body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive Response]';
          else if (!body) body = `[${msgType} message]`;

          // Upsert contact record, update last_message_at & update contact name if missing
          const contactRes = await pool.query(
            `INSERT INTO contacts (organization_id, wa_number, name, last_message_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             ON CONFLICT (organization_id, wa_number) DO UPDATE SET
               last_message_at = NOW(),
               name = CASE
                 WHEN contacts.name IS NULL OR TRIM(contacts.name) = '' OR contacts.name = contacts.wa_number OR contacts.name = 'Unknown' OR contacts.name = 'Unsaved'
                 THEN COALESCE(EXCLUDED.name, contacts.name)
                 ELSE contacts.name
               END,
               updated_at = NOW()
             RETURNING *`,
            [organizationId, waNumber, profileName]
          );

          let contact = contactRes.rows[0];

          // Explicit check to update contact's name if profileName is available and contact has no valid name
          if (profileName && (!contact.name || contact.name.trim() === '' || contact.name === contact.wa_number || contact.name === 'Unknown' || contact.name === 'Unsaved')) {
            const updateNameRes = await pool.query(
              `UPDATE contacts SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
              [profileName, contact.id]
            );
            contact = updateNameRes.rows[0];
          }

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

          // Handle Opt-Out (STOP) and Opt-In logic
          const cleanText = (body || '').trim().toUpperCase();
          const isStopCommand = cleanText === 'STOP' || cleanText === 'UNSUBSCRIBE' || cleanText === 'STOPALL';

          if (isStopCommand) {
            // Contact sends STOP -> Opt Out & reply with template
            await pool.query(
              `UPDATE contacts SET opt_in_status = 'opted_out', opt_out_timestamp = NOW(), updated_at = NOW() WHERE id = $1`,
              [contact.id]
            );
            contact.opt_in_status = 'opted_out';
            console.log(`Contact ${contact.wa_number} opted out via STOP command.`);

            // Remove "24h Active" tag on opt-out
            try {
              const tagRes = await pool.query(`SELECT id FROM tags WHERE organization_id = $1 AND name = '24h Active'`, [organizationId]);
              if (tagRes.rows.length > 0) {
                await pool.query(`DELETE FROM contact_tags WHERE contact_id = $1 AND tag_id = $2`, [contact.id, tagRes.rows[0].id]);
              }
            } catch (e) {}

            await this.sendOptOutReply(organizationId, contact, conversationId);
          } else {
            if (contact.opt_in_status === 'opted_out') {
              // Contact is currently opted_out and sends ANY message -> Opt In
              await pool.query(
                `UPDATE contacts SET opt_in_status = 'opted_in', opt_in_timestamp = NOW(), opt_out_timestamp = NULL, updated_at = NOW() WHERE id = $1`,
                [contact.id]
              );
              contact.opt_in_status = 'opted_in';
              console.log(`Contact ${contact.wa_number} automatically opted back in.`);
            }

            // Auto-assign "24h Active" tag for active 24h window
            try {
              const ContactService = require('./ContactService');
              const tag24h = await ContactService.getOrCreate24hTag(organizationId);
              await pool.query(
                `INSERT INTO contact_tags (contact_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [contact.id, tag24h.id]
              );
            } catch (tagErr) {
              console.error('Error auto-tagging 24h contact:', tagErr);
            }
          }
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
