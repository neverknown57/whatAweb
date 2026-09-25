const pool = require('../db');
const WhatsAppService = require('./WhatsAppService');

class TemplateService {
  /**
   * Ensure database schema includes default_parameter_mapping column
   */
  static async ensureSchema() {
    try {
      await pool.query(
        `ALTER TABLE templates ADD COLUMN IF NOT EXISTS default_parameter_mapping JSONB DEFAULT '{}'::jsonb;`
      );
    } catch (err) {
      // Ignore if column already exists
    }
  }

  /**
   * Extract default parameter mappings from Meta Cloud API component example objects
   */
  static extractDefaultMapping(components = []) {
    const mapping = {};

    for (const comp of components) {
      if (comp.type === 'HEADER') {
        if (comp.format === 'TEXT' && comp.example?.header_text?.[0]) {
          mapping.header_text = comp.example.header_text[0];
          mapping.header_var_1 = comp.example.header_text[0];
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format) && comp.example?.header_handle?.[0]) {
          mapping.header_media_url = comp.example.header_handle[0];
        }
      } else if (comp.type === 'BODY') {
        const sampleArray = comp.example?.body_text?.[0] || [];
        sampleArray.forEach((val, idx) => {
          const varIndex = idx + 1;
          mapping[`body_var_${varIndex}`] = val;
          mapping[varIndex.toString()] = val;
        });
      } else if (comp.type === 'BUTTONS') {
        (comp.buttons || []).forEach((btn, idx) => {
          if (btn.type === 'URL' && btn.example?.[0]) {
            mapping[`button_url_${idx}`] = btn.example[0];
          }
        });
      }
    }

    return mapping;
  }

  /**
   * Sync templates from Meta API to DB
   */
  static async syncTemplates(organizationId = 1) {
    try {
      await this.ensureSchema();
      const metaTemplates = await WhatsAppService.fetchMetaTemplates(organizationId);

      for (const t of metaTemplates) {
        const extractedMapping = this.extractDefaultMapping(t.components || []);

        await pool.query(
          `INSERT INTO templates (organization_id, name, language, status, category, components, default_parameter_mapping, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (organization_id, name, language)
           DO UPDATE SET status = EXCLUDED.status,
                         category = EXCLUDED.category,
                         components = EXCLUDED.components,
                         default_parameter_mapping = CASE
                           WHEN templates.default_parameter_mapping IS NULL OR templates.default_parameter_mapping = '{}'::jsonb
                           THEN EXCLUDED.default_parameter_mapping
                           ELSE templates.default_parameter_mapping
                         END,
                         synced_at = NOW()`,
          [
            organizationId,
            t.name,
            t.language,
            t.status,
            t.category,
            JSON.stringify(t.components || []),
            JSON.stringify(extractedMapping),
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
    await this.ensureSchema();
    const res = await pool.query(
      `SELECT id, organization_id, name, language, status, category, components, default_parameter_mapping, synced_at
       FROM templates WHERE organization_id = $1 ORDER BY name ASC`,
      [organizationId]
    );
    return res.rows;
  }

  /**
   * Get cached template from DB or auto-fetch from Meta API if missing from DB
   */
  static async getOrFetchTemplate(organizationId = 1, name, requestedLanguage = null) {
    await this.ensureSchema();
    if (!name) return null;

    // 1. Check DB for exact language match
    if (requestedLanguage) {
      const matchExact = await pool.query(
        `SELECT * FROM templates WHERE organization_id = $1 AND name = $2 AND language = $3 LIMIT 1`,
        [organizationId, name, requestedLanguage]
      );
      if (matchExact.rows.length > 0) return matchExact.rows[0];
    }

    // 2. Check DB for any language match for this template name
    const matchAny = await pool.query(
      `SELECT * FROM templates WHERE organization_id = $1 AND name = $2 LIMIT 1`,
      [organizationId, name]
    );
    if (matchAny.rows.length > 0) return matchAny.rows[0];

    // 3. Not in DB -> Trigger auto-sync from Meta Cloud API
    try {
      console.log(`Template "${name}" not found in DB. Auto-syncing templates from Meta Cloud API...`);
      await this.syncTemplates(organizationId);

      // Re-query DB after sync
      if (requestedLanguage) {
        const reMatchExact = await pool.query(
          `SELECT * FROM templates WHERE organization_id = $1 AND name = $2 AND language = $3 LIMIT 1`,
          [organizationId, name, requestedLanguage]
        );
        if (reMatchExact.rows.length > 0) return reMatchExact.rows[0];
      }

      const reMatchAny = await pool.query(
        `SELECT * FROM templates WHERE organization_id = $1 AND name = $2 LIMIT 1`,
        [organizationId, name]
      );
      if (reMatchAny.rows.length > 0) return reMatchAny.rows[0];
    } catch (err) {
      console.error(`Auto-sync templates failed for template ${name}:`, err.message);
    }

    return null;
  }

  /**
   * Save dynamic component values / parameter mapping to database for a template
   */
  static async saveTemplateMapping(organizationId, identifier, mapping = {}) {
    await this.ensureSchema();
    let query;
    let params;

    const isNumeric = typeof identifier === 'number' || (typeof identifier === 'string' && /^\d+$/.test(identifier));

    if (isNumeric) {
      query = `UPDATE templates SET default_parameter_mapping = $1 WHERE organization_id = $2 AND id = $3 RETURNING *`;
      params = [JSON.stringify(mapping), organizationId, parseInt(identifier, 10)];
    } else {
      query = `UPDATE templates SET default_parameter_mapping = $1 WHERE organization_id = $2 AND name = $3 RETURNING *`;
      params = [JSON.stringify(mapping), organizationId, identifier];
    }

    const res = await pool.query(query, params);
    return res.rows[0] || null;
  }

  /**
   * Parse template components to analyze required variables and parameter types
   */
  static analyzeTemplate(template) {
    const components = template.components || [];
    const defaultMapping = template.default_parameter_mapping || template.parameter_mapping || {};

    const analysis = {
      header: null,
      bodyParams: [],
      footer: null,
      buttons: [],
      defaultMapping: defaultMapping,
    };

    for (const comp of components) {
      if (comp.type === 'HEADER') {
        analysis.header = {
          format: comp.format, // TEXT, IMAGE, VIDEO, DOCUMENT
          text: comp.text || null,
          hasVariable: comp.text ? /\{\{\d+\}\}/.test(comp.text) : false,
          defaultValue: defaultMapping.header_text || defaultMapping.header_var_1 || null,
        };
      } else if (comp.type === 'BODY') {
        const text = comp.text || '';
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const uniqueIndices = [...new Set(matches.map((m) => m.replace(/[^\d]/g, '')))].sort(
          (a, b) => parseInt(a) - parseInt(b)
        );
        analysis.bodyParams = uniqueIndices.map((idx) => {
          const key = `body_var_${idx}`;
          return {
            paramIndex: parseInt(idx),
            key: key,
            label: `Variable {{${idx}}}`,
            defaultValue: defaultMapping[key] !== undefined ? defaultMapping[key] : (defaultMapping[idx] || null),
          };
        });
      } else if (comp.type === 'FOOTER') {
        analysis.footer = comp.text || null;
      } else if (comp.type === 'BUTTONS') {
        analysis.buttons = (comp.buttons || []).map((btn, idx) => ({
          type: btn.type, // QUICK_REPLY, URL, PHONE_NUMBER
          text: btn.text,
          url: btn.url || null,
          hasVariable: btn.url ? /\{\{\d+\}\}/.test(btn.url) : false,
          index: idx,
          defaultValue: defaultMapping[`button_url_${idx}`] || null,
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
    if (paramValue === null || paramValue === undefined) return '';

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
        resolved = resolved.replace(regex, String(v !== null && v !== undefined ? v : ''));
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
          const rawVal =
            mapping.header_text !== undefined
              ? mapping.header_text
              : mapping.header_var_1 !== undefined
              ? mapping.header_var_1
              : mapping.header || '';
          const resolvedVal = this.resolveValue(rawVal, contact);
          metaComponents.push({
            type: 'header',
            parameters: [{ type: 'text', text: resolvedVal || 'Header' }],
          });
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format)) {
          const mediaUrl =
            mapping.header_media_url || mapping.header_url || mapping.media_url || '';
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
            const rawVal =
              mapping[`body_var_${idx}`] !== undefined
                ? mapping[`body_var_${idx}`]
                : mapping[idx] !== undefined
                ? mapping[idx]
                : mapping[`var_${idx}`] !== undefined
                ? mapping[`var_${idx}`]
                : '';
            const resolvedVal = this.resolveValue(rawVal, contact);
            return { type: 'text', text: resolvedVal !== '' ? resolvedVal : `Variable ${idx}` };
          });

          metaComponents.push({
            type: 'body',
            parameters: bodyParameters,
          });
        }
      } else if (comp.type === 'BUTTONS') {
        (comp.buttons || []).forEach((btn, btnIdx) => {
          if (btn.type === 'URL' && /\{\{\d+\}\}/.test(btn.url || '')) {
            const rawVal =
              mapping[`button_url_${btnIdx}`] !== undefined
                ? mapping[`button_url_${btnIdx}`]
                : mapping[`button_${btnIdx}`] !== undefined
                ? mapping[`button_${btnIdx}`]
                : '';
            const resolvedVal = this.resolveValue(rawVal, contact);
            metaComponents.push({
              type: 'button',
              sub_type: 'url',
              index: btnIdx.toString(),
              parameters: [{ type: 'text', text: resolvedVal || 'Link' }],
            });
          }
        });
      }
    }

    return metaComponents;
  }
}

module.exports = TemplateService;
