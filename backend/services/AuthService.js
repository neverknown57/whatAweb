const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_whatsapp_crm';

class AuthService {
  static async login(email, password) {
    const res = await pool.query(
      `SELECT u.*, o.name AS organization_name
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = res.rows[0];
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organization_id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
      },
    };
  }

  static async register(name, email, password, organizationName = 'Default Business') {
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      throw new Error('User with this email already exists.');
    }

    // Create organization
    const orgRes = await pool.query(
      `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
      [organizationName]
    );
    const orgId = orgRes.rows[0].id;

    // Create WhatsApp Account record for org
    await pool.query(
      `INSERT INTO whatsapp_accounts (organization_id, verify_token) VALUES ($1, 'verify_token_secret')`,
      [orgId]
    );

    // Hash password & create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await pool.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id, name, email, role, organization_id`,
      [orgId, name, email.toLowerCase().trim(), passwordHash]
    );

    const user = userRes.rows[0];
    return this.login(email, password);
  }
}

module.exports = AuthService;
