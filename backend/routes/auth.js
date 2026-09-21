const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: { message: 'Email and password are required.' } });
  }

  try {
    const result = await AuthService.login(email, password);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(401).json({ success: false, error: { message: err.message } });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, organization_name } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: { message: 'Name, email, and password are required.' } });
  }

  try {
    const result = await AuthService.register(name, email, password, organization_name);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
