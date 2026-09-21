const express = require('express');
const router = express.Router();
const WebhookService = require('../services/WebhookService');
const WhatsAppService = require('../services/WhatsAppService');

// GET /webhook -> Meta verification challenge handshake
router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const creds = await WhatsAppService.getCredentials(1);
  const verifyToken = creds.verifyToken || 'whatsapp_verify_token_secret';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook subscription verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /webhook -> Meta event callbacks
router.post('/', (req, res) => {
  // CRITICAL REQUIREMENT: Acknowledge HTTP 200 OK immediately so Meta doesn't retry or drop webhooks
  res.sendStatus(200);

  // Process event asynchronously
  WebhookService.processEvent(req.body).catch((err) => {
    console.error('Asynchronous Webhook Event processing error:', err);
  });
});

module.exports = router;
