const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const pool = require('../db');
const ContactService = require('./ContactService');

class ImportService {
  /**
   * Parse CSV or XLSX buffer to array of row objects
   */
  static async parseFile(buffer, originalname) {
    const ext = originalname.split('.').pop().toLowerCase();
    let rows = [];

    if (ext === 'xlsx' || ext === 'xls') {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    } else {
      // CSV parsing
      rows = await new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer);
        stream
          .pipe(csvParser())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (err) => reject(err));
      });
    }

    return rows;
  }

  /**
   * Auto-detect header column mappings
   */
  static detectColumns(rows = []) {
    if (!rows.length) return {};
    const sample = rows[0];
    const headers = Object.keys(sample);

    const mapping = {
      phone: '',
      name: '',
      email: '',
      tags: '',
      notes: '',
    };

    headers.forEach((h) => {
      const lower = h.trim().toLowerCase();
      if (['phone', 'whatsapp', 'wa_number', 'mobile', 'number', 'phone number'].includes(lower)) {
        mapping.phone = h;
      } else if (['name', 'full name', 'contact name', 'first name'].includes(lower)) {
        mapping.name = h;
      } else if (['email', 'email address'].includes(lower)) {
        mapping.email = h;
      } else if (['tag', 'tags', 'label', 'categories'].includes(lower)) {
        mapping.tags = h;
      } else if (['note', 'notes', 'comment'].includes(lower)) {
        mapping.notes = h;
      }
    });

    return { headers, suggestedMapping: mapping, preview: rows.slice(0, 5) };
  }

  /**
   * Process async contact import
   */
  static async processImport(organizationId = 1, userId = null, fileName, rows = [], mapping = {}, duplicateStrategy = 'SKIP') {
    // 1. Create Import Record
    const importRes = await pool.query(
      `INSERT INTO imports (organization_id, file_name, total_rows, status, created_by)
       VALUES ($1, $2, $3, 'processing', $4) RETURNING *`,
      [organizationId, fileName, rows.length, userId]
    );
    const importRecord = importRes.rows[0];
    const importId = importRecord.id;

    let successfulRows = 0;
    let failedRows = 0;
    let skippedRows = 0;
    let updatedRows = 0;
    const errorDetails = [];

    const phoneKey = mapping.phone;
    const nameKey = mapping.name;
    const emailKey = mapping.email;
    const tagsKey = mapping.tags;
    const notesKey = mapping.notes;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 1;

      try {
        const rawPhone = row[phoneKey];
        const normalizedPhone = ContactService.normalizePhoneNumber(rawPhone);

        if (!normalizedPhone) {
          failedRows++;
          errorDetails.push({
            row: rowIndex,
            rawPhone: rawPhone || '',
            error: 'Invalid or missing phone number format',
          });
          continue;
        }

        const name = nameKey ? String(row[nameKey] || '').trim() : null;
        const email = emailKey ? String(row[emailKey] || '').trim() : null;
        const notes = notesKey ? String(row[notesKey] || '').trim() : null;
        const rawTags = tagsKey ? String(row[tagsKey] || '').trim() : '';

        // Extract custom fields (any columns not mapped to standard fields)
        const mappedKeys = Object.values(mapping).filter(Boolean);
        const customFields = {};
        for (const [k, v] of Object.entries(row)) {
          if (!mappedKeys.includes(k) && v !== undefined && v !== '') {
            customFields[k] = v;
          }
        }

        // Check if contact already exists
        const existingRes = await pool.query(
          `SELECT id FROM contacts WHERE organization_id = $1 AND wa_number = $2`,
          [organizationId, normalizedPhone]
        );
        const existing = existingRes.rows[0];

        if (existing && duplicateStrategy === 'SKIP') {
          skippedRows++;
          continue;
        }

        // Create or Update Contact
        const contact = await ContactService.createOrUpdateContact(organizationId, {
          wa_number: normalizedPhone,
          name,
          email,
          notes,
          source: `import:${fileName}`,
          custom_fields: customFields,
          opt_in_status: 'opted_in',
        });

        if (existing && duplicateStrategy === 'UPDATE') {
          updatedRows++;
        } else {
          successfulRows++;
        }

        // Handle Tags
        if (rawTags && contact) {
          const tagList = rawTags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
          for (const tagName of tagList) {
            const tagRes = await pool.query(
              `INSERT INTO tags (organization_id, name, color)
               VALUES ($1, $2, '#3b82f6')
               ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [organizationId, tagName]
            );
            const tagId = tagRes.rows[0].id;
            await ContactService.addTag(organizationId, contact.id, tagId);
          }
        }
      } catch (err) {
        failedRows++;
        errorDetails.push({
          row: rowIndex,
          error: err.message || 'Processing error',
        });
      }
    }

    // Update Import Log
    await pool.query(
      `UPDATE imports SET
         successful_rows = $1,
         failed_rows = $2,
         skipped_rows = $3,
         updated_rows = $4,
         status = 'completed',
         error_details = $5
       WHERE id = $6`,
      [successfulRows, failedRows, skippedRows, updatedRows, JSON.stringify(errorDetails), importId]
    );

    return {
      importId,
      totalRows: rows.length,
      successfulRows,
      failedRows,
      skippedRows,
      updatedRows,
      errorDetails,
    };
  }
}

module.exports = ImportService;
