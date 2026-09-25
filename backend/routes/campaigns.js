const express = require('express');
const router = express.Router();
const pool = require('../db');
const CampaignService = require('../services/CampaignService');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/campaigns - List all campaigns
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT c.*, u.name AS creator_name
       FROM campaigns c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE c.organization_id = $1
       ORDER BY c.created_at DESC`,
      [orgId]
    );

    res.json({ success: true, campaigns: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// GET /api/campaigns/:id - Single campaign details
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );

    const campaign = result.rows[0];
    if (!campaign) return res.status(404).json({ success: false, error: { message: 'Campaign not found' } });

    // Recipient breakdown
    const recipientStats = await pool.query(
      `SELECT status, COUNT(*) AS count FROM campaign_recipients WHERE campaign_id = $1 GROUP BY status`,
      [campaign.id]
    );

    res.json({ success: true, campaign, recipientStats: recipientStats.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns - Create new campaign
router.post('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user.userId;
    const campaign = await CampaignService.createCampaign(orgId, userId, req.body);
    res.status(201).json({ success: true, campaign });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/start - Trigger execution worker
router.post('/:id/start', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    CampaignService.startCampaignWorker(orgId, req.params.id);
    res.json({ success: true, message: 'Campaign execution started.' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/pause - Pause campaign
router.post('/:id/pause', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await CampaignService.pauseCampaign(orgId, req.params.id);
    res.json({ success: true, message: 'Campaign paused.' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/resume - Resume campaign
router.post('/:id/resume', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await CampaignService.resumeCampaign(orgId, req.params.id);
    res.json({ success: true, message: 'Campaign resumed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/cancel - Cancel campaign
router.post('/:id/cancel', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    await CampaignService.cancelCampaign(orgId, req.params.id);
    res.json({ success: true, message: 'Campaign cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/relaunch - Relaunch existing campaign
router.post('/:id/relaunch', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const userId = req.user.userId;
    const newCampaign = await CampaignService.relaunchCampaign(orgId, userId, req.params.id, req.body || {});
    res.status(201).json({ success: true, campaign: newCampaign, message: 'Campaign relaunched successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
