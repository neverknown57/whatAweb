const express = require('express');
const router = express.Router();
const ContactService = require('../services/ContactService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/contacts - List contacts with pagination, search, tag filter, and opt-in filter
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await ContactService.getContacts(orgId, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch contacts' } });
  }
});

// GET /api/contacts/:id - Single contact details
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const contact = await ContactService.getContactById(orgId, req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: { message: 'Contact not found' } });
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/contacts - Create or update contact
router.post('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const contact = await ContactService.createOrUpdateContact(orgId, req.body);
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/contacts/:id/tags - Assign tag(s) to a contact
router.post('/:id/tags', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { tag_id, tag_ids, tags } = req.body;
    let contact;
    if (tag_ids || tags) {
      const tagList = tag_ids || tags;
      contact = await ContactService.setContactTags(orgId, req.params.id, Array.isArray(tagList) ? tagList : [tagList], false);
    } else if (tag_id) {
      contact = await ContactService.addTag(orgId, req.params.id, tag_id);
    } else {
      return res.status(400).json({ success: false, error: { message: 'tag_id, tag_ids, or tags is required' } });
    }
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PUT /api/contacts/:id/tags - Replace all tags for a contact
router.put('/:id/tags', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { tag_ids, tags } = req.body;
    const tagList = tag_ids || tags || [];
    const contact = await ContactService.setContactTags(orgId, req.params.id, Array.isArray(tagList) ? tagList : [tagList], true);
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/contacts/:id/tags/:tagId - Remove tag
router.delete('/:id/tags/:tagId', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await ContactService.removeTag(orgId, req.params.id, req.params.tagId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/contacts/bulk-tag - Bulk tag contacts
router.post('/bulk-tag', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { contact_ids, tag_id, action = 'add' } = req.body;
    await ContactService.bulkTag(orgId, contact_ids, tag_id, action);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await ContactService.deleteContact(orgId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/contacts/refresh-24h - Refresh 24h active tags and clean up expired tags (> 24h)
router.post('/refresh-24h', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await ContactService.refresh24hTags(orgId);
    res.json(result);
  } catch (err) {
    console.error('Error refreshing 24h tags:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/contacts/export - Export contacts CSV
router.post('/export', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { contacts } = await ContactService.getContacts(orgId, { limit: 10000, ...req.body });

    let csv = 'ID,Name,Phone Number,Email,Opt In Status,Source,Created At\n';
    contacts.forEach((c) => {
      const name = (c.name || '').replace(/"/g, '""');
      const email = (c.email || '').replace(/"/g, '""');
      csv += `"${c.id}","${name}","${c.wa_number}","${email}","${c.opt_in_status}","${c.source}","${c.created_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts_export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
