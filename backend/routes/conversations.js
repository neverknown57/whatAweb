const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/conversations - List active chat conversations
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT conv.*, 
              c.wa_number, c.name AS contact_name, c.email AS contact_email, c.last_message_at AS customer_last_message_at,
              COALESCE(
                json_agg(
                  json_build_object('id', t.id, 'name', t.name, 'color', t.color)
                ) FILTER (WHERE t.id IS NOT NULL), '[]'
              ) AS tags
       FROM conversations conv
       JOIN contacts c ON c.id = conv.contact_id
       LEFT JOIN contact_tags ct ON ct.contact_id = c.id
       LEFT JOIN tags t ON t.id = ct.tag_id
       WHERE conv.organization_id = $1
       GROUP BY conv.id, c.id
       ORDER BY conv.last_message_at DESC`,
      [orgId]
    );

    res.json({ success: true, conversations: result.rows });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch conversations' } });
  }
});

// GET /api/conversations/:contactId/messages - Get chat thread messages for a contact
router.get('/:contactId/messages', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const contactId = req.params.contactId;

    // Reset unread count
    await pool.query(
      `UPDATE conversations SET unread_count = 0 WHERE contact_id = $1 AND organization_id = $2`,
      [contactId, orgId]
    );

    const result = await pool.query(
      `SELECT * FROM messages
       WHERE contact_id = $1 AND organization_id = $2
       ORDER BY created_at ASC`,
      [contactId, orgId]
    );

    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch messages' } });
  }
});

module.exports = router;
