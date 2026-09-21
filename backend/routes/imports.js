const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
const ImportService = require('../services/ImportService');
const { authMiddleware } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

router.use(authMiddleware);

// POST /api/imports/upload - Parse uploaded file and suggest column headers
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No file uploaded.' } });
  }

  try {
    const rows = await ImportService.parseFile(req.file.buffer, req.file.originalname);
    const analysis = ImportService.detectColumns(rows);
    res.json({
      success: true,
      fileName: req.file.originalname,
      totalRows: rows.length,
      ...analysis,
    });
  } catch (err) {
    console.error('Error parsing file upload:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to parse import file.' } });
  }
});

// POST /api/imports/process - Confirm mapping & duplicate strategy, start background import
router.post('/process', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: { message: 'No file provided.' } });
  }

  try {
    const orgId = req.user.organizationId;
    const userId = req.user.userId;
    const { mapping, duplicate_strategy = 'SKIP' } = req.body;
    const parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;

    const rows = await ImportService.parseFile(req.file.buffer, req.file.originalname);

    const result = await ImportService.processImport(
      orgId,
      userId,
      req.file.originalname,
      rows,
      parsedMapping,
      duplicate_strategy
    );

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error processing import:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Import processing failed.' } });
  }
});

// GET /api/imports - Get import history
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT i.*, u.name AS uploaded_by_name
       FROM imports i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.organization_id = $1
       ORDER BY i.created_at DESC`,
      [orgId]
    );

    res.json({ success: true, imports: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// GET /api/imports/:id/errors - Download CSV error log for failed rows
router.get('/:id/errors', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT file_name, error_details FROM imports WHERE id = $1 AND organization_id = $2`,
      [req.params.id, orgId]
    );

    const imp = result.rows[0];
    if (!imp) return res.status(404).json({ success: false, error: { message: 'Import log not found' } });

    const errors = imp.error_details || [];
    let csv = 'Row Number,Phone Number,Error Reason\n';
    errors.forEach((e) => {
      csv += `"${e.row}","${e.rawPhone || ''}","${(e.error || '').replace(/"/g, '""')}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import_errors_${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

module.exports = router;
