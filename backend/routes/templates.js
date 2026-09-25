const express = require('express');
const router = express.Router();
const pool = require('../db');
const TemplateService = require('../services/TemplateService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/templates - List cached Meta templates
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const templates = await TemplateService.getTemplates(orgId);
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/templates/sync - Sync latest templates from Meta Cloud API
router.post('/sync', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const metaTemplates = await TemplateService.syncTemplates(orgId);
    res.json({ success: true, count: metaTemplates.length, templates: metaTemplates });
  } catch (err) {
    console.error('Error syncing templates:', err?.response?.data || err);
    res.status(500).json({
      success: false,
      error: { message: err?.response?.data?.error?.message || err.message || 'Failed to sync templates from Meta API' },
    });
  }
});

// GET /api/templates/:name/analyze - Inspect template variable structure and parameter inputs
router.get('/:name/analyze', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await TemplateService.ensureSchema();
    const result = await pool.query(
      `SELECT * FROM templates WHERE organization_id = $1 AND (name = $2 OR id::text = $2) LIMIT 1`,
      [orgId, req.params.name]
    );

    const template = result.rows[0];
    if (!template) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    const analysis = TemplateService.analyzeTemplate(template);
    res.json({ success: true, template, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PUT /api/templates/:identifier/mapping - Save dynamic field / component parameter mapping
router.put('/:identifier/mapping', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const identifier = req.params.identifier;
    const mapping = req.body.parameter_mapping || req.body.mapping || req.body;

    const updatedTemplate = await TemplateService.saveTemplateMapping(orgId, identifier, mapping);
    if (!updatedTemplate) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    const analysis = TemplateService.analyzeTemplate(updatedTemplate);
    res.json({ success: true, template: updatedTemplate, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/templates/:identifier/mapping - Alternative endpoint for saving parameter mapping
router.post('/:identifier/mapping', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const identifier = req.params.identifier;
    const mapping = req.body.parameter_mapping || req.body.mapping || req.body;

    const updatedTemplate = await TemplateService.saveTemplateMapping(orgId, identifier, mapping);
    if (!updatedTemplate) {
      return res.status(404).json({ success: false, error: { message: 'Template not found' } });
    }

    const analysis = TemplateService.analyzeTemplate(updatedTemplate);
    res.json({ success: true, template: updatedTemplate, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
