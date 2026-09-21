const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/tags - List tags with contact count
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const result = await pool.query(
      `SELECT t.*, COUNT(ct.contact_id)::int AS contact_count
       FROM tags t
       LEFT JOIN contact_tags ct ON ct.tag_id = t.id
       WHERE t.organization_id = $1
       GROUP BY t.id
       ORDER BY t.name ASC`,
      [orgId]
    );
    res.json({ success: true, tags: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch tags' } });
  }
});

// POST /api/tags - Create or update tag
router.post('/', async (req, res) => {
  const { name, color = '#3b82f6' } = req.body;
  const orgId = req.user.organizationId;

  if (!name) return res.status(400).json({ success: false, error: { message: 'Name is required' } });
  try {
    const result = await pool.query(
      `INSERT INTO tags (organization_id, name, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO UPDATE SET color = EXCLUDED.color
       RETURNING *`,
      [orgId, name.trim(), color]
    );
    res.status(201).json({ success: true, tag: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Failed to create tag' } });
  }
});

// PATCH /api/tags/:id - Update tag name/color
router.patch('/:id', async (req, res) => {
  const { name, color } = req.body;
  const orgId = req.user.organizationId;

  try {
    const result = await pool.query(
      `UPDATE tags SET
         name = COALESCE($1, name),
         color = COALESCE($2, color)
       WHERE id = $3 AND organization_id = $4 RETURNING *`,
      [name, color, req.params.id, orgId]
    );
    res.json({ success: true, tag: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /api/tags/:id - Delete tag
router.delete('/:id', async (req, res) => {
  const orgId = req.user.organizationId;
  try {
    await pool.query(`DELETE FROM tags WHERE id = $1 AND organization_id = $2`, [req.params.id, orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete tag' } });
  }
});

module.exports = router;
