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
      message_type = 'template',
      message_body = '',
      language_code,
      parameter_mapping = {},
      audience_type = 'all',
      audience_filter = {},
    } = campaignData;

    if (!name) {
      throw new Error('Campaign name is required.');
    }

    const isFreeText =
      message_type === 'text' ||
      ['image', 'video', 'document', 'audio'].includes(message_type) ||
      template_name === 'FREE_TEXT' ||
      template_name === 'FREE_MEDIA' ||
      template_name === 'text' ||
      (!template_name && (message_body || parameter_mapping.media_url || parameter_mapping.message_body));

    const effectiveTemplateName = isFreeText ? 'FREE_TEXT' : template_name;

    if (!isFreeText && !template_name) {
      throw new Error('template_name is required for template campaigns.');
    }

    // Fetch template default parameter mapping and registered language code from DB (auto-syncing if missing)
    let resolvedLanguageCode = 'en_US';
    let storedDefaultMapping = {};

    if (!isFreeText) {
      const templateRow = await TemplateService.getOrFetchTemplate(organizationId, effectiveTemplateName, language_code);
      resolvedLanguageCode = templateRow?.language || language_code || 'en_US';
      storedDefaultMapping = templateRow?.default_parameter_mapping || {};
    }

    const finalParameterMapping = {
      message_type: message_type || (parameter_mapping.media_url ? 'image' : 'text'),
      message_body: message_body || parameter_mapping.message_body || '',
      media_url: parameter_mapping.media_url || campaignData.media_url || '',
      media_type: parameter_mapping.media_type || message_type || 'image',
      ...storedDefaultMapping,
      ...parameter_mapping,
    };

    // 1. Evaluate target audience contacts (excluding opted-out contacts)
    let contactSql = `SELECT c.* FROM contacts c WHERE c.organization_id = $1 AND c.opt_in_status = 'opted_in'`;
    const sqlParams = [organizationId];

    const filterObj = typeof audience_filter === 'string' ? JSON.parse(audience_filter) : (audience_filter || {});
    const targetTagId = filterObj.tag_id || filterObj.tagId;

    if (audience_type === '24h_window' || audience_type === '24h' || filterObj.within_24h) {
      contactSql += ` AND c.last_message_at >= NOW() - INTERVAL '24 hours'`;
    } else if (audience_type === 'tags' && targetTagId) {
      contactSql += ` AND c.id IN (SELECT contact_id FROM contact_tags WHERE tag_id = $2)`;
      sqlParams.push(parseInt(targetTagId, 10));
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
        effectiveTemplateName,
        resolvedLanguageCode,
        JSON.stringify(finalParameterMapping),
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

    const parameterMapping = campaign.parameter_mapping || {};
    const isFreeSessionMsg =
      campaign.template_name === 'FREE_TEXT' ||
      campaign.template_name === 'FREE_MEDIA' ||
      campaign.template_name === 'text' ||
      ['text', 'image', 'video', 'document', 'audio'].includes(parameterMapping.message_type) ||
      Boolean(parameterMapping.media_url);

    let templateComponents = [];
    let effectiveLanguage = campaign.language_code || 'en_US';

    if (!isFreeSessionMsg) {
      const templateRow = await TemplateService.getOrFetchTemplate(organizationId, campaign.template_name, campaign.language_code);
      templateComponents = templateRow?.components || [];
      const storedDefaultMapping = templateRow?.default_parameter_mapping || {};
      Object.assign(parameterMapping, storedDefaultMapping);
      effectiveLanguage = templateRow?.language || campaign.language_code || 'en_US';
    }

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
        if (isFreeSessionMsg) {
          // Verify recipient is inside 24h customer window
          const hours = (Date.now() - new Date(r.last_message_at).getTime()) / 36e5;
          const isWithin24h = r.last_message_at && hours < 24;

          if (!isWithin24h) {
            failedCount++;
            await pool.query(
              `UPDATE campaign_recipients SET status = 'failed', error_message = $1 WHERE id = $2`,
              ['Outside 24h customer window. Free session broadcasts require an active 24h window.', r.recipient_id]
            );
            continue;
          }

          const rawBody = parameterMapping.message_body || parameterMapping.body || '';
          const resolvedBody = TemplateService.resolveValue(rawBody, r);
          const mediaUrl = parameterMapping.media_url || parameterMapping.header_media_url || null;
          const rawMsgType = parameterMapping.message_type || (mediaUrl ? 'image' : 'text');
          const mediaType = ['image', 'video', 'document', 'audio'].includes(rawMsgType) ? rawMsgType : (mediaUrl ? 'image' : null);

          let waRes;
          let msgTypeLogged = 'text';

          if (mediaUrl && mediaType) {
            waRes = await WhatsAppService.sendMedia(organizationId, r.wa_number, mediaType, mediaUrl, resolvedBody);
            msgTypeLogged = mediaType;
          } else {
            waRes = await WhatsAppService.sendText(organizationId, r.wa_number, resolvedBody || campaign.name);
          }

          const waMessageId = waRes.messages?.[0]?.id;

          const msgRes = await pool.query(
            `INSERT INTO messages (
               organization_id, contact_id, direction, type, body, media_url, wa_message_id, status, campaign_id
             ) VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'sent', $7) RETURNING id`,
            [organizationId, r.id, msgTypeLogged, resolvedBody || `[${msgTypeLogged}]`, mediaUrl, waMessageId, campaignId]
          );

          sentCount++;
          await pool.query(
            `UPDATE campaign_recipients SET status = 'sent', message_id = $1, sent_at = NOW() WHERE id = $2`,
            [msgRes.rows[0].id, r.recipient_id]
          );
        } else {
          // Build Meta API parameter payload components
          const metaComponents = TemplateService.buildPayloadComponents(templateComponents, parameterMapping, r);

          // Send via Meta Cloud API
          const waRes = await WhatsAppService.sendTemplate(
            organizationId,
            r.wa_number,
            campaign.template_name,
            effectiveLanguage,
            metaComponents
          );

          const waMessageId = waRes.messages?.[0]?.id;

          // Log message record
          const msgRes = await pool.query(
            `INSERT INTO messages (
               organization_id, contact_id, direction, type, body, template_name, template_params, wa_message_id, status, campaign_id
             ) VALUES ($1, $2, 'outbound', 'template', $3, $4, $5, $6, 'sent', $7) RETURNING id`,
            [
              organizationId,
              r.id,
              `[Campaign: ${campaign.name}]`,
              campaign.template_name,
              JSON.stringify(metaComponents),
              waMessageId,
              campaignId,
            ]
          );

          const messageId = msgRes.rows[0].id;
          sentCount++;

          // Update recipient record
          await pool.query(
            `UPDATE campaign_recipients SET status = 'sent', message_id = $1, sent_at = NOW() WHERE id = $2`,
            [messageId, r.recipient_id]
          );
        }
      } catch (err) {
        failedCount++;
        console.error('Campaign message failed for recipient:', r.wa_number, err?.response?.data || err);
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

  /**
   * Relaunch an existing campaign with option to modify parameters / audience
   */
  static async relaunchCampaign(organizationId, userId, campaignId, options = {}) {
    const origRes = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1 AND organization_id = $2`,
      [campaignId, organizationId]
    );

    const orig = origRes.rows[0];
    if (!orig) {
      throw new Error('Original campaign not found to relaunch.');
    }

    const relaunchName = options.name || `${orig.name} (Relaunch ${new Date().toLocaleDateString()})`;
    const parameterMapping = options.parameter_mapping || orig.parameter_mapping || {};
    const audienceType = options.audience_type || orig.audience_type || 'all';
    const audienceFilter = options.audience_filter || orig.audience_filter || {};

    // Create new campaign draft with recipient resolution
    const newCampaign = await this.createCampaign(organizationId, userId, {
      name: relaunchName,
      template_name: orig.template_name,
      language_code: orig.language_code || 'en_US',
      parameter_mapping: parameterMapping,
      audience_type: audienceType,
      audience_filter: audienceFilter,
    });

    if (options.auto_launch) {
      this.startCampaignWorker(organizationId, newCampaign.id);
    }

    return newCampaign;
  }
}

module.exports = CampaignService;
