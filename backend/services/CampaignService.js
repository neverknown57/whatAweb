const pool = require('../db');
const WhatsAppService = require('./WhatsAppService');
const TemplateService = require('./TemplateService');

class CampaignService {
  /**
   * Create new campaign draft and resolve target audience recipients
   */
  static async createCampaign(organizationId = 1, userId = null, campaignData = {}) {
    const {
      name,
      template_name,
      language_code = 'en_US',
      parameter_mapping = {},
      audience_type = 'all',
      audience_filter = {},
    } = campaignData;

    if (!name || !template_name) {
      throw new Error('Campaign name and template_name are required.');
    }

    // 1. Evaluate target audience contacts (excluding opted-out contacts)
    let contactSql = `SELECT c.* FROM contacts c WHERE c.organization_id = $1 AND c.opt_in_status = 'opted_in'`;
    const sqlParams = [organizationId];

    if (audience_type === 'tags' && audience_filter.tag_id) {
      contactSql += ` AND c.id IN (SELECT contact_id FROM contact_tags WHERE tag_id = $2)`;
      sqlParams.push(audience_filter.tag_id);
    }

    const audienceRes = await pool.query(contactSql, sqlParams);
    const recipients = audienceRes.rows;

    // 2. Insert Campaign record
    const campaignRes = await pool.query(
      `INSERT INTO campaigns (
         organization_id, name, template_name, language_code, parameter_mapping,
         audience_type, audience_filter, total_recipients, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9) RETURNING *`,
      [
        organizationId,
        name,
        template_name,
        language_code,
        JSON.stringify(parameter_mapping),
        audience_type,
        JSON.stringify(audience_filter),
        recipients.length,
        userId,
      ]
    );

    const campaign = campaignRes.rows[0];

    // 3. Insert Campaign Recipient records
    for (const c of recipients) {
      await pool.query(
        `INSERT INTO campaign_recipients (campaign_id, contact_id, status)
         VALUES ($1, $2, 'queued')`,
        [campaign.id, c.id]
      );
    }

    return campaign;
  }

  /**
   * Asynchronous background campaign worker
   */
  static async startCampaignWorker(organizationId, campaignId) {
    // Set status to running
    await pool.query(
      `UPDATE campaigns SET status = 'running', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [campaignId, organizationId]
    );

    // Fetch campaign definition & cached template components
    const campRes = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]);
    const campaign = campRes.rows[0];
    if (!campaign) return;

    const tRes = await pool.query(
      `SELECT components FROM templates WHERE organization_id = $1 AND name = $2 AND language = $3 LIMIT 1`,
      [organizationId, campaign.template_name, campaign.language_code]
    );
    const templateComponents = tRes.rows[0]?.components || [];
    const parameterMapping = campaign.parameter_mapping || {};

    // Fetch queued recipients with contact details
    const recipientRes = await pool.query(
      `SELECT cr.id AS recipient_id, c.*
       FROM campaign_recipients cr
       JOIN contacts c ON c.id = cr.contact_id
       WHERE cr.campaign_id = $1 AND cr.status = 'queued'`,
      [campaignId]
    );

    const recipients = recipientRes.rows;
    let sentCount = campaign.sent_count || 0;
    let failedCount = campaign.failed_count || 0;

    for (const r of recipients) {
      // Check if campaign was paused or cancelled during processing
      const checkStatus = await pool.query(`SELECT status FROM campaigns WHERE id = $1`, [campaignId]);
      const currentStatus = checkStatus.rows[0]?.status;
      if (currentStatus === 'paused' || currentStatus === 'cancelled') {
        console.log(`Campaign ${campaignId} was ${currentStatus}. Worker halting.`);
        return;
      }

      try {
        // Build Meta API parameter payload components
        const metaComponents = TemplateService.buildPayloadComponents(templateComponents, parameterMapping, r);

        // Send via Meta Cloud API
        const waRes = await WhatsAppService.sendTemplate(
          organizationId,
          r.wa_number,
          campaign.template_name,
          campaign.language_code,
          metaComponents
        );

        const waMessageId = waRes.messages?.[0]?.id;

        // Log message record
        const msgRes = await pool.query(
          `INSERT INTO messages (
             organization_id, contact_id, direction, type, body, template_name, template_params, wa_message_id, status
           ) VALUES ($1, $2, 'outbound', 'template', $3, $4, $5, $6, 'sent') RETURNING id`,
          [
            organizationId,
            r.id,
            `[Campaign: ${campaign.name}]`,
            campaign.template_name,
            JSON.stringify(metaComponents),
            waMessageId,
          ]
        );

        const messageId = msgRes.rows[0].id;
        sentCount++;

        // Update recipient record
        await pool.query(
          `UPDATE campaign_recipients SET status = 'sent', message_id = $1, sent_at = NOW() WHERE id = $2`,
          [messageId, r.recipient_id]
        );
      } catch (err) {
        failedCount++;
        const errorMsg = err?.response?.data?.error?.message || err.message;
        await pool.query(
          `UPDATE campaign_recipients SET status = 'failed', error_message = $1 WHERE id = $2`,
          [errorMsg, r.recipient_id]
        );
      }

      // Update counters on campaign
      await pool.query(
        `UPDATE campaigns SET sent_count = $1, failed_count = $2, updated_at = NOW() WHERE id = $3`,
        [sentCount, failedCount, campaignId]
      );

      // Rate limit pause (50ms delay = max 20 msgs/sec safely)
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Mark campaign completed if all recipients processed
    await pool.query(
      `UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );
  }

  /**
   * Pause Campaign
   */
  static async pauseCampaign(organizationId, campaignId) {
    await pool.query(
      `UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [campaignId, organizationId]
    );
  }

  /**
   * Resume Campaign
   */
  static async resumeCampaign(organizationId, campaignId) {
    this.startCampaignWorker(organizationId, campaignId);
  }

  /**
   * Cancel Campaign
   */
  static async cancelCampaign(organizationId, campaignId) {
    await pool.query(
      `UPDATE campaigns SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [campaignId, organizationId]
    );
  }
}

module.exports = CampaignService;
