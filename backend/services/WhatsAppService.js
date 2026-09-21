const axios = require('axios');
const pool = require('../db');

class WhatsAppService {
  /**
   * Get active credentials for an organization (DB fallback to env vars)
   */
  static async getCredentials(organizationId = 1) {
    try {
      const res = await pool.query(
        `SELECT * FROM whatsapp_accounts WHERE organization_id = $1 LIMIT 1`,
        [organizationId]
      );
      const acc = res.rows[0];

      const phoneNumberId = acc?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
      const accessToken = acc?.access_token || process.env.WHATSAPP_ACCESS_TOKEN;
      const wabaId = acc?.waba_id || process.env.WHATSAPP_WABA_ID;
      const apiVersion = acc?.api_version || process.env.WHATSAPP_API_VERSION || 'v21.0';
      const verifyToken = acc?.verify_token || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'whatsapp_verify_token_secret';

      return { phoneNumberId, accessToken, wabaId, apiVersion, verifyToken };
    } catch (err) {
      console.error('Error fetching WhatsApp credentials:', err);
      return {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        wabaId: process.env.WHATSAPP_WABA_ID,
        apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
        verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'whatsapp_verify_token_secret',
      };
    }
  }

  static async getClient(organizationId = 1) {
    const creds = await this.getCredentials(organizationId);
    if (!creds.phoneNumberId || !creds.accessToken) {
      throw new Error('WhatsApp API credentials (PHONE_NUMBER_ID or ACCESS_TOKEN) are missing.');
    }

    return axios.create({
      baseURL: `https://graph.facebook.com/${creds.apiVersion}/${creds.phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send free-form text message (24h customer service window)
   */
  static async sendText(organizationId, toNumber, body) {
    const client = await this.getClient(organizationId);
    const cleanNumber = toNumber.replace(/[^\d]/g, '');
    const res = await client.post('/messages', {
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: 'text',
      text: { body },
    });
    return res.data;
  }

  /**
   * Send WhatsApp Template message
   */
  static async sendTemplate(organizationId, toNumber, templateName, languageCode = 'en_US', components = []) {
    const client = await this.getClient(organizationId);
    const cleanNumber = toNumber.replace(/[^\d]/g, '');
    const res = await client.post('/messages', {
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components,
      },
    });
    return res.data;
  }

  /**
   * Send Media Message (image, video, document, audio)
   */
  static async sendMedia(organizationId, toNumber, type, mediaUrl, caption = '') {
    const client = await this.getClient(organizationId);
    const cleanNumber = toNumber.replace(/[^\d]/g, '');
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: type,
      [type]: {
        link: mediaUrl,
        ...(caption && (type === 'image' || type === 'video' || type === 'document') ? { caption } : {}),
      },
    };
    const res = await client.post('/messages', payload);
    return res.data;
  }

  /**
   * Fetch templates from Meta Cloud API
   */
  static async fetchMetaTemplates(organizationId = 1) {
    const creds = await this.getCredentials(organizationId);
    if (!creds.wabaId || !creds.accessToken) {
      throw new Error('WABA ID and Access Token are required to fetch Meta templates.');
    }

    const url = `https://graph.facebook.com/${creds.apiVersion}/${creds.wabaId}/message_templates`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
      params: { limit: 100 },
    });
    return res.data.data || [];
  }
}

module.exports = WhatsAppService;
