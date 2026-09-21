const axios = require('axios');
require('dotenv').config();

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const client = axios.create({
  baseURL: `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Send a free-form text message.
 * NOTE: only works if the contact messaged you within the last 24 hours
 * (WhatsApp's "customer service window"). Otherwise use sendTemplate().
 */
async function sendText(toNumber, body) {
  const res = await client.post('/messages', {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'text',
    text: { body },
  });
  return res.data; // contains messages[0].id -> WhatsApp's message ID
}

/**
 * Send an approved template message (works any time, no 24h window restriction).
 * templateName must match a template already approved in the Meta dashboard.
 * params is an array of strings filling the template's {{1}}, {{2}}... placeholders.
 */
async function sendTemplate(toNumber, templateName, languageCode = 'en_US', params = []) {
  const components = params.length
    ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }]
    : [];

  const res = await client.post('/messages', {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
  return res.data;
}

module.exports = { sendText, sendTemplate };
