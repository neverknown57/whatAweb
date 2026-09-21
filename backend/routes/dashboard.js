const express = require('express');
const router = express.Router();
const pool = require('../db');
const DashboardService = require('../services/DashboardService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/dashboard/stats - Consolidate analytics stats & KPI metrics
router.get('/stats', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const stats = await DashboardService.getStats(orgId);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch dashboard stats' } });
  }
});

// GET /api/dashboard/config - Get WhatsApp Account configuration (masked token)
router.get('/config', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT id, waba_id, phone_number_id, display_phone_number, verify_token, api_version
       FROM whatsapp_accounts WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    );

    const config = result.rows[0] || {};
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/dashboard/config - Update WhatsApp credentials securely
router.post('/config', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const { waba_id, phone_number_id, access_token, verify_token, api_version = 'v21.0' } = req.body;

    const result = await pool.query(
      `INSERT INTO whatsapp_accounts (organization_id, waba_id, phone_number_id, access_token, verify_token, api_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         waba_id = EXCLUDED.waba_id,
         phone_number_id = EXCLUDED.phone_number_id,
         access_token = COALESCE(NULLIF(EXCLUDED.access_token, ''), whatsapp_accounts.access_token),
         verify_token = EXCLUDED.verify_token,
         api_version = EXCLUDED.api_version
       RETURNING id, waba_id, phone_number_id, verify_token, api_version`,
      [orgId, waba_id, phone_number_id, access_token || '', verify_token, api_version]
    );

    res.json({ success: true, config: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
