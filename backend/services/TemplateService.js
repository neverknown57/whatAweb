const pool = require('../db');
const WhatsAppService = require('./WhatsAppService');

class TemplateService {
  /**
   * Sync templates from Meta API to DB
   */
  static async syncTemplates(organizationId = 1) {
    try {
      const metaTemplates = await WhatsAppService.fetchMetaTemplates(organizationId);
      for (const t of metaTemplates) {
        await pool.query(
          `INSERT INTO templates (organization_id, name, language, status, category, components, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (organization_id, name, language)
           DO UPDATE SET status = EXCLUDED.status, category = EXCLUDED.category,
                         components = EXCLUDED.components, synced_at = NOW()`,
          [
            organizationId,
            t.name,
            t.language,
            t.status,
            t.category,
            JSON.stringify(t.components || []),
          ]
        );
      }
      return metaTemplates;
    } catch (err) {
      console.error('Error syncing templates:', err?.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Get cached templates
   */
  static async getTemplates(organizationId = 1) {
    const res = await pool.query(
      `SELECT * FROM templates WHERE organization_id = $1 ORDER BY name ASC`,
      [organizationId]
    );
    return res.rows;
  }

  /**
   * Parse template components to analyze required variables and parameter types
   */
  static analyzeTemplate(template) {
    const components = template.components || [];
    const analysis = {
      header: null,
      bodyParams: [],
      footer: null,
      buttons: [],
    };

    for (const comp of components) {
      if (comp.type === 'HEADER') {
        analysis.header = {
          format: comp.format, // TEXT, IMAGE, VIDEO, DOCUMENT
          text: comp.text || null,
          hasVariable: comp.text ? /\{\{\d+\}\}/.test(comp.text) : false,
        };
      } else if (comp.type === 'BODY') {
        const text = comp.text || '';
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const uniqueIndices = [...new Set(matches.map((m) => m.replace(/[^\d]/g, '')))].sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        analysis.bodyParams = uniqueIndices.map((idx) => ({
          paramIndex: parseInt(idx),
          key: `body_var_${idx}`,
          label: `Variable {{${idx}}}`,
        }));
      } else if (comp.type === 'FOOTER') {
        analysis.footer = comp.text || null;
      } else if (comp.type === 'BUTTONS') {
        analysis.buttons = (comp.buttons || []).map((btn, idx) => ({
          type: btn.type, // QUICK_REPLY, URL, PHONE_NUMBER
          text: btn.text,
          url: btn.url || null,
          hasVariable: btn.url ? /\{\{\d+\}\}/.test(btn.url) : false,
          index: idx,
        }));
      }
    }

    return analysis;
  }

  /**
   * Resolve parameter value against contact data & system variables
   * e.g., "{{contact.name}}" -> contact.name
   */
  static resolveValue(paramValue, contact = {}, customFields = {}) {
    if (!paramValue) return '';

    let resolved = String(paramValue);

    // Dynamic contact attributes
    resolved = resolved.replace(/\{\{contact\.name\}\}/gi, contact.name || 'Customer');
    resolved = resolved.replace(/\{\{contact\.wa_number\}\}/gi, contact.wa_number || '');
    resolved = resolved.replace(/\{\{contact\.phone\}\}/gi, contact.wa_number || '');
    resolved = resolved.replace(/\{\{contact\.email\}\}/gi, contact.email || '');

    // System variables
    resolved = resolved.replace(/\{\{current_date\}\}/gi, new Date().toLocaleDateString());
    resolved = resolved.replace(/\{\{current_time\}\}/gi, new Date().toLocaleTimeString());

    // Contact custom fields {{contact.custom_fields.key}} or {{contact.key}}
    if (contact.custom_fields || customFields) {
      const mergedFields = { ...(contact.custom_fields || {}), ...customFields };
      for (const [k, v] of Object.entries(mergedFields)) {
        const regex = new RegExp(`\\{\\{contact\\.(custom_fields\\.)?${k}\\}\\}`, 'gi');
        resolved = resolved.replace(regex, String(v || ''));
      }
    }

    return resolved;
  }

  /**
   * Build Meta Cloud API payload components array from parameter mapping
   */
  static buildPayloadComponents(templateComponents, mapping = {}, contact = {}) {
    const metaComponents = [];

    for (const comp of templateComponents) {
      if (comp.type === 'HEADER') {
        if (comp.format === 'TEXT' && /\{\{\d+\}\}/.test(comp.text || '')) {
          const rawVal = mapping.header_text || '';
          const resolvedVal = this.resolveValue(rawVal, contact);
          metaComponents.push({
            type: 'header',
            parameters: [{ type: 'text', text: resolvedVal }],
          });
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          const mediaUrl = mapping.header_media_url || '';
          if (mediaUrl) {
            metaComponents.push({
              type: 'header',
              parameters: [
                {
                  type: comp.format.toLowerCase(),
                  [comp.format.toLowerCase()]: { link: mediaUrl },
                },
              ],
            });
          }
        }
      } else if (comp.type === 'BODY') {
        const text = comp.text || '';
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const uniqueIndices = [...new Set(matches.map((m) => m.replace(/[^\d]/g, '')))].sort(
          (a, b) => parseInt(a) - parseInt(b)
        );

        if (uniqueIndices.length > 0) {
          const bodyParameters = uniqueIndices.map((idx) => {
            const rawVal = mapping[`body_var_${idx}`] || mapping[idx] || '';
            const resolvedVal = this.resolveValue(rawVal, contact);
            return { type: 'text', text: resolvedVal || `Placeholder ${idx}` };
          });

          metaComponents.push({
            type: 'body',
            parameters: bodyParameters,
          });
        }
      } else if (comp.type === 'BUTTONS') {
        (comp.buttons || []).forEach((btn, btnIdx) => {
          if (btn.type === 'URL' && /\{\{\d+\}\}/.test(btn.url || '')) {
            const rawVal = mapping[`button_url_${btnIdx}`] || '';
            const resolvedVal = this.resolveValue(rawVal, contact);
            metaComponents.push({
              type: 'button',
              sub_type: 'url',
              index: btnIdx.toString(),
              parameters: [{ type: 'text', text: resolvedVal }],
            });
          }
        });
      }
    }

    return metaComponents;
  }
}

module.exports = TemplateService;
