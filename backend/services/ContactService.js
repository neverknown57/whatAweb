const pool = require('../db');

class ContactService {
  /**
   * Normalize phone number to E.164 format digits
   * e.g. "+1 (415) 555-2671" -> "14155552671"
   */
  static normalizePhoneNumber(phone) {
    if (!phone) return null;
    const digitsOnly = String(phone).replace(/[^\d]/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return null;
    }
    return digitsOnly;
  }

  /**
   * Fetch contacts with search, tag filter, opt-in filter, pagination & tag aggregation
   */
  static async getContacts(organizationId = 1, params = {}) {
    const {
      page = 1,
      limit = 25,
      search = '',
      tag = '',
      opt_in = '',
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = params;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 25;
    const offset = (pageNum - 1) * limitNum;

    const values = [organizationId];
    let index = 2;

    let whereClause = `WHERE c.organization_id = $1`;

    if (search) {
      whereClause += ` AND (c.name ILIKE $${index} OR c.wa_number ILIKE $${index} OR c.email ILIKE $${index})`;
      values.push(`%${search}%`);
      index++;
    }

    if (opt_in) {
      whereClause += ` AND c.opt_in_status = $${index}`;
      values.push(opt_in);
      index++;
    }

    let tagJoin = '';
    if (tag) {
      tagJoin = `JOIN contact_tags ct_filter ON ct_filter.contact_id = c.id
                 JOIN tags t_filter ON t_filter.id = ct_filter.tag_id AND (t_filter.name ILIKE $${index} OR t_filter.id::text = $${index})`;
      values.push(tag);
      index++;
    }

    // Count total rows
    const countSql = `SELECT COUNT(DISTINCT c.id) FROM contacts c ${tagJoin} ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count);

    // Fetch paginated rows with aggregated tags
    const allowedSort = ['name', 'created_at', 'last_message_at', 'wa_number'];
    const safeSort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const safeOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const fetchValues = [...values, limitNum, offset];
    const fetchSql = `
      SELECT c.*, 
             COALESCE(
               json_agg(
                 json_build_object('id', t.id, 'name', t.name, 'color', t.color)
               ) FILTER (WHERE t.id IS NOT NULL), '[]'
             ) AS tags
      FROM contacts c
      ${tagJoin}
      LEFT JOIN contact_tags ct ON ct.contact_id = c.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.${safeSort} ${safeOrder}
      LIMIT $${index} OFFSET $${index + 1}
    `;

    const res = await pool.query(fetchSql, fetchValues);

    return {
      contacts: res.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Get single contact by ID with tags and conversation history
   */
  static async getContactById(organizationId, contactId) {
    const res = await pool.query(
      `SELECT c.*, 
              COALESCE(
                json_agg(
                  json_build_object('id', t.id, 'name', t.name, 'color', t.color)
                ) FILTER (WHERE t.id IS NOT NULL), '[]'
              ) AS tags
       FROM contacts c
       LEFT JOIN contact_tags ct ON ct.contact_id = c.id
       LEFT JOIN tags t ON t.id = ct.tag_id
       WHERE c.id = $1 AND c.organization_id = $2
       GROUP BY c.id`,
      [contactId, organizationId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Create or update contact
   */
  static async createOrUpdateContact(organizationId = 1, data = {}) {
    const {
      wa_number,
      name = null,
      email = null,
      country_code = null,
      source = 'manual',
      notes = null,
      custom_fields = {},
      opt_in_status = 'opted_in',
    } = data;

    const normalized = this.normalizePhoneNumber(wa_number);
    if (!normalized) {
      throw new Error(`Invalid phone number: ${wa_number}. Must be valid digits.`);
    }

    const res = await pool.query(
      `INSERT INTO contacts (
         organization_id, wa_number, name, email, country_code, source, notes, custom_fields, opt_in_status, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (organization_id, wa_number) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, contacts.name),
         email = COALESCE(EXCLUDED.email, contacts.email),
         country_code = COALESCE(EXCLUDED.country_code, contacts.country_code),
         notes = COALESCE(EXCLUDED.notes, contacts.notes),
         custom_fields = contacts.custom_fields || EXCLUDED.custom_fields,
         opt_in_status = EXCLUDED.opt_in_status,
         updated_at = NOW()
       RETURNING *`,
      [
        organizationId,
        normalized,
        name,
        email,
        country_code,
        source,
        notes,
        JSON.stringify(custom_fields || {}),
        opt_in_status,
      ]
    );

    const contact = res.rows[0];

    // Handle tag assignment if tags or tag_ids provided
    const tagsInput = data.tag_ids || data.tags;
    if (tagsInput && Array.isArray(tagsInput) && tagsInput.length > 0) {
      await this.setContactTags(organizationId, contact.id, tagsInput, false);
    }

    return await this.getContactById(organizationId, contact.id);
  }

  /**
   * Helper to resolve tag IDs from array of IDs, names, or objects
   */
  static async resolveTagIds(organizationId, tagsInput = []) {
    if (!Array.isArray(tagsInput) || tagsInput.length === 0) return [];

    const tagIds = [];
    for (const item of tagsInput) {
      if (item === null || item === undefined) continue;

      let tagId = null;
      if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item.trim()))) {
        tagId = parseInt(item, 10);
      } else if (typeof item === 'object' && item.id) {
        tagId = parseInt(item.id, 10);
      } else if (typeof item === 'string' && item.trim()) {
        const tagName = item.trim();
        const tagRes = await pool.query(
          `INSERT INTO tags (organization_id, name, color)
           VALUES ($1, $2, '#3b82f6')
           ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [organizationId, tagName]
        );
        tagId = tagRes.rows[0].id;
      }

      if (tagId && !tagIds.includes(tagId)) {
        tagIds.push(tagId);
      }
    }
    return tagIds;
  }

  /**
   * Assign or replace multiple tags for a contact
   */
  static async setContactTags(organizationId, contactId, tagsInput = [], replace = false) {
    const tagIds = await this.resolveTagIds(organizationId, tagsInput);

    if (replace) {
      if (tagIds.length === 0) {
        await pool.query(`DELETE FROM contact_tags WHERE contact_id = $1`, [contactId]);
      } else {
        await pool.query(
          `DELETE FROM contact_tags 
           WHERE contact_id = $1 AND tag_id NOT IN (SELECT unnest($2::int[]))`,
          [contactId, tagIds]
        );
      }
    }

    for (const tagId of tagIds) {
      await pool.query(
        `INSERT INTO contact_tags (contact_id, tag_id)
         SELECT $1, id FROM tags WHERE id = $2 AND organization_id = $3
         ON CONFLICT DO NOTHING`,
        [contactId, tagId, organizationId]
      );
    }

    return await this.getContactById(organizationId, contactId);
  }

  /**
   * Add tag to contact
   */
  static async addTag(organizationId, contactId, tagId) {
    await pool.query(
      `INSERT INTO contact_tags (contact_id, tag_id)
       SELECT $1, id FROM tags WHERE id = $2 AND organization_id = $3
       ON CONFLICT DO NOTHING`,
      [contactId, tagId, organizationId]
    );
    return await this.getContactById(organizationId, contactId);
  }

  /**
   * Remove tag from contact
   */
  static async removeTag(organizationId, contactId, tagId) {
    await pool.query(
      `DELETE FROM contact_tags
       WHERE contact_id = $1 AND tag_id IN (SELECT id FROM tags WHERE id = $2 AND organization_id = $3)`,
      [contactId, tagId, organizationId]
    );
    return await this.getContactById(organizationId, contactId);
  }

  /**
   * Bulk tag contacts
   */
  static async bulkTag(organizationId, contactIds = [], tagId, action = 'add') {
    if (!contactIds.length) return;
    if (action === 'add') {
      await pool.query(
        `INSERT INTO contact_tags (contact_id, tag_id)
         SELECT c.id, $2 FROM contacts c WHERE c.id = ANY($1::int[]) AND c.organization_id = $3
         ON CONFLICT DO NOTHING`,
        [contactIds, tagId, organizationId]
      );
    } else {
      await pool.query(
        `DELETE FROM contact_tags
         WHERE tag_id = $2 AND contact_id = ANY($1::int[])`,
        [contactIds, tagId]
      );
    }
  }

  /**
   * Delete contact
   */
  static async deleteContact(organizationId, contactId) {
    await pool.query(
      `DELETE FROM contacts WHERE id = $1 AND organization_id = $2`,
      [contactId, organizationId]
    );
  }
}

module.exports = ContactService;
