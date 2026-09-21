const express = require('express');
const router = express.Router();
const pool = require('../db');
const WhatsAppService = require('../services/WhatsAppService');
const TemplateService = require('../services/TemplateService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Helper: 24h customer window check
function withinSessionWindow(lastMessageAt) {
  if (!lastMessageAt) return false;
  const hours = (Date.now() - new Date(lastMessageAt).getTime()) / 36e5;
  return hours < 24;
}

// POST /api/messages/send - Send free-text message (24h window)
router.post('/send', async (req, res) => {
  const { contact_id, body } = req.body;
  const orgId = req.user.organizationId;

  try {
    const contactRes = await pool.query(`SELECT * FROM contacts WHERE id = $1 AND organization_id = $2`, [contact_id, orgId]);
    const contact = contactRes.rows[0];
    if (!contact) return res.status(404).json({ success: false, error: { message: 'Contact not found' } });

    if (!withinSessionWindow(contact.last_message_at)) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SESSION_WINDOW_EXPIRED',
          message: 'Outside 24h customer service window. Please use an approved Meta template.',
        },
      });
    }

    const waRes = await WhatsAppService.sendText(orgId, contact.wa_number, body);
    const waMessageId = waRes.messages?.[0]?.id;

    // Get or create conversation
    const convRes = await pool.query(
      `INSERT INTO conversations (organization_id, contact_id, status, last_message_preview, last_message_at)
       VALUES ($1, $2, 'open', $3, NOW())
       ON CONFLICT (contact_id) DO UPDATE SET
         last_message_preview = EXCLUDED.last_message_preview,
         last_message_at = NOW()
       RETURNING id`,
      [orgId, contact_id, body]
    );

    const saved = await pool.query(
      `INSERT INTO messages (
         organization_id, contact_id, conversation_id, direction, type, body, wa_message_id, status
       ) VALUES ($1, $2, $3, 'outbound', 'text', $4, $5, 'sent') RETURNING *`,
      [orgId, contact_id, convRes.rows[0].id, body, waMessageId]
    );

    res.status(201).json({ success: true, message: saved.rows[0] });
  } catch (err) {
    console.error('Error sending message:', err?.response?.data || err);
    res.status(500).json({ success: false, error: { message: err?.response?.data?.error?.message || 'Failed to send message' } });
  }
});

// POST /api/messages/send-template - Send approved template message
router.post('/send-template', async (req, res) => {
  const { contact_id, template_name, language_code = 'en_US', parameter_mapping = {} } = req.body;
  const orgId = req.user.organizationId;

  try {
    const contactRes = await pool.query(`SELECT * FROM contacts WHERE id = $1 AND organization_id = $2`, [contact_id, orgId]);
    const contact = contactRes.rows[0];
    if (!contact) return res.status(404).json({ success: false, error: { message: 'Contact not found' } });

    // Fetch cached template components
    const tRes = await pool.query(
      `SELECT components FROM templates WHERE organization_id = $1 AND name = $2 LIMIT 1`,
      [orgId, template_name]
    );

    const components = tRes.rows[0]?.components || [];
    const metaComponents = TemplateService.buildPayloadComponents(components, parameter_mapping, contact);

    const waRes = await WhatsAppService.sendTemplate(orgId, contact.wa_number, template_name, language_code, metaComponents);
    const waMessageId = waRes.messages?.[0]?.id;

    // Get or create conversation
    const convRes = await pool.query(
      `INSERT INTO conversations (organization_id, contact_id, status, last_message_preview, last_message_at)
       VALUES ($1, $2, 'open', $3, NOW())
       ON CONFLICT (contact_id) DO UPDATE SET
         last_message_preview = EXCLUDED.last_message_preview,
         last_message_at = NOW()
       RETURNING id`,
      [orgId, contact_id, `[Template: ${template_name}]`]
    );

    const saved = await pool.query(
      `INSERT INTO messages (
         organization_id, contact_id, conversation_id, direction, type, body, template_name, template_params, wa_message_id, status
       ) VALUES ($1, $2, $3, 'outbound', 'template', $4, $5, $6, $7, 'sent') RETURNING *`,
      [orgId, contact_id, convRes.rows[0].id, `[Template: ${template_name}]`, template_name, JSON.stringify(metaComponents), waMessageId]
    );

    res.status(201).json({ success: true, message: saved.rows[0] });
  } catch (err) {
    console.error('Error sending template message:', err?.response?.data || err);
    res.status(500).json({ success: false, error: { message: err?.response?.data?.error?.message || 'Failed to send template message' } });
  }
});

// POST /api/messages/send-media - Send media attachment (image, video, document, audio)
router.post('/send-media', async (req, res) => {
  const { contact_id, type, media_url, caption = '' } = req.body;
  const orgId = req.user.organizationId;

  try {
    const contactRes = await pool.query(`SELECT * FROM contacts WHERE id = $1 AND organization_id = $2`, [contact_id, orgId]);
    const contact = contactRes.rows[0];
    if (!contact) return res.status(404).json({ success: false, error: { message: 'Contact not found' } });

    const waRes = await WhatsAppService.sendMedia(orgId, contact.wa_number, type, media_url, caption);
    const waMessageId = waRes.messages?.[0]?.id;

    const convRes = await pool.query(
      `INSERT INTO conversations (organization_id, contact_id, status, last_message_preview, last_message_at)
       VALUES ($1, $2, 'open', $3, NOW())
       ON CONFLICT (contact_id) DO UPDATE SET
         last_message_preview = EXCLUDED.last_message_preview,
         last_message_at = NOW()
       RETURNING id`,
      [orgId, contact_id, `[${type.toUpperCase()}] ${caption}`]
    );

    const saved = await pool.query(
      `INSERT INTO messages (
         organization_id, contact_id, conversation_id, direction, type, body, media_url, wa_message_id, status
       ) VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, 'sent') RETURNING *`,
      [orgId, contact_id, convRes.rows[0].id, type, caption || `[${type}]`, media_url, waMessageId]
    );

    res.status(201).json({ success: true, message: saved.rows[0] });
  } catch (err) {
    console.error('Error sending media:', err?.response?.data || err);
    res.status(500).json({ success: false, error: { message: err?.response?.data?.error?.message || 'Failed to send media' } });
  }
});

module.exports = router;
