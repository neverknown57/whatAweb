const pool = require('../db');

class DashboardService {
  static async getStats(organizationId = 1) {
    // 1. Contact stats
    const totalContactsRes = await pool.query(
      `SELECT COUNT(*) FROM contacts WHERE organization_id = $1`,
      [organizationId]
    );
    const recentContactsRes = await pool.query(
      `SELECT COUNT(*) FROM contacts WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [organizationId]
    );

    // 2. Message status breakdown
    const msgStatsRes = await pool.query(
      `SELECT status, direction, COUNT(*) AS count
       FROM messages
       WHERE organization_id = $1
       GROUP BY status, direction`,
      [organizationId]
    );

    const msgStats = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      inbound: 0,
    };

    msgStatsRes.rows.forEach((r) => {
      const c = parseInt(r.count);
      if (r.direction === 'inbound') {
        msgStats.inbound += c;
      } else {
        if (r.status === 'sent') msgStats.sent += c;
        else if (r.status === 'delivered') msgStats.delivered += c;
        else if (r.status === 'read') msgStats.read += c;
        else if (r.status === 'failed') msgStats.failed += c;
      }
    });

    // 3. Active 24h conversations
    const activeConvsRes = await pool.query(
      `SELECT COUNT(*) FROM contacts
       WHERE organization_id = $1 AND last_message_at >= NOW() - INTERVAL '24 hours'`,
      [organizationId]
    );

    // 4. Contacts by Tag distribution
    const tagDistRes = await pool.query(
      `SELECT t.name, t.color, COUNT(ct.contact_id) AS count
       FROM tags t
       LEFT JOIN contact_tags ct ON ct.tag_id = t.id
       WHERE t.organization_id = $1
       GROUP BY t.id
       ORDER BY count DESC LIMIT 6`,
      [organizationId]
    );

    // 5. Recent Broadcast Campaigns
    const recentCampaignsRes = await pool.query(
      `SELECT id, name, template_name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at
       FROM campaigns
       WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [organizationId]
    );

    return {
      contacts: {
        total: parseInt(totalContactsRes.rows[0].count),
        recent7Days: parseInt(recentContactsRes.rows[0].count),
      },
      messages: msgStats,
      activeConversations24h: parseInt(activeConvsRes.rows[0].count),
      tagsDistribution: tagDistRes.rows.map((r) => ({ name: r.name, color: r.color, count: parseInt(r.count) })),
      recentCampaigns: recentCampaignsRes.rows,
    };
  }
}

module.exports = DashboardService;
