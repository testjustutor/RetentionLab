/**
 * root/models/AdminModel.js
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

function isValidIdentifier(name) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

class AdminModel {
  static listTables() {
    return new Promise((resolve, reject) => {
      db.all("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()", (err, tables) => {
        if (err) return reject(err);
        resolve(tables
          .map(t => ({ name: t.name }))
          .filter(t => !t.name.startsWith('sqlite_'))
        );
      });
    });
  }

  static getTableInfo(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.all(`SHOW COLUMNS FROM \`${tableName}\``, (err, columns) => {
        if (err) return reject(err);
        resolve(columns.map(c => ({ name: c.Field, type: c.Type, notNull: c.Null === 'NO', default: c.Default, pk: c.Key === 'PRI' ? 1 : 0 })) || []);
        if (err) return reject(err);
        resolve(columns || []);
      });
    });
  }

  static getTableRows(tableName, limit = 1000) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      if (limit && Number(limit) > 0) {
        db.all(`SELECT * FROM \`${tableName}\` LIMIT ?`, [limit], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      } else {
        db.all(`SELECT * FROM \`${tableName}\``, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }
    });
  }

  static clearTable(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.run(`DELETE FROM \`${tableName}\``, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static countTable(tableName) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.get(`SELECT COUNT(*) as count FROM \`${tableName}\``, [], (err, row) => {
        if (err) return reject(err);
        resolve(row?.count ?? 0);
      });
    });
  }

  static deleteRow(tableName, id) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      db.run(`DELETE FROM \`${tableName}\` WHERE id = ?`, [Number(id)], function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static insertRow(tableName, data) {
    return new Promise((resolve, reject) => {
      if (!isValidIdentifier(tableName)) return reject(new Error('Invalid table name'));
      const cols = Object.keys(data || {});
      if (!cols.length) return reject(new Error('No data provided'));
      const placeholders = cols.map(() => '?').join(',');
      const params = cols.map(key => data[key]);
      const sql = `INSERT INTO \`${tableName}\` (${cols.join(',')}) VALUES (${placeholders})`;
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  static getAllTableCounts() {
    return AdminModel.listTables().then(tables => {
      const promises = tables.map(t => AdminModel.countTable(t.name).then(count => ({ name: t.name, count })));
      return Promise.all(promises);
    });
  }

  static getDashboardCounts() {
    return AdminModel.listTables().then(tables => {
      const promises = tables.map(t => AdminModel.countTable(t.name).then(count => ({ table: t.name, count })));
      return Promise.all(promises);
    });
  }

  static async getDashboardOverview() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Get today's meetings
      const todayMeetings = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM meetings WHERE DATE(scheduled_start_time) = ?`, [today], (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      // Get this week's meetings
      const weekMeetings = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM meetings WHERE DATE(scheduled_start_time) >= ?`, [weekAgo], (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      // Get active users
      const activeUsers = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`, (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      // Get average quality score
      const avgScoreResult = await new Promise((resolve, reject) => {
        db.get(`SELECT AVG(score) as avg FROM meeting_session_scores WHERE score IS NOT NULL`, (err, row) => {
          if (err) return reject(err);
          resolve(row?.avg || 0);
        });
      });
      const avgScore = avgScoreResult ? Math.round(avgScoreResult) : 0;

      // Get completion rate (meetings with scores / total meetings)
      const totalMeetings = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as count FROM meetings`, (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      const completedMeetings = await new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(DISTINCT meeting_id) as count FROM meeting_session_scores`, (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      const completionRate = totalMeetings > 0 ? Math.round((completedMeetings / totalMeetings) * 100) : 0;

      // Get meeting trends (last 7 days)
      const trends = await new Promise((resolve, reject) => {
        db.all(`SELECT DATE(scheduled_start_time) as date, COUNT(*) as count FROM meetings WHERE scheduled_start_time >= ? GROUP BY DATE(scheduled_start_time) ORDER BY date ASC`, [weekAgo], (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      // Get score distribution
      const scoreDistribution = await new Promise((resolve, reject) => {
        db.all(`SELECT 
          CASE 
            WHEN score >= 80 THEN 'Excellent (80-100)'
            WHEN score >= 60 THEN 'Good (60-79)'
            WHEN score >= 40 THEN 'Average (40-59)'
            ELSE 'Needs Improvement (<40)'
          END as score_range,
          COUNT(*) as count
        FROM meeting_session_scores 
        WHERE score IS NOT NULL
        GROUP BY score_range`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      // Get meeting status distribution
      const statusDistribution = await new Promise((resolve, reject) => {
        db.all(`SELECT status, COUNT(*) as count FROM meetings GROUP BY status`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      // Get platform usage
      const platformUsage = await new Promise((resolve, reject) => {
        db.all(`SELECT platform, COUNT(*) as count FROM meetings WHERE platform IS NOT NULL GROUP BY platform ORDER BY count DESC LIMIT 10`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      // Get recent activity
      const recentActivity = await new Promise((resolve, reject) => {
        db.all(`SELECT m.scheduled_start_time as time, m.title as meeting, m.platform, m.status FROM meetings m ORDER BY m.scheduled_start_time DESC LIMIT 10`, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      return {
        kpis: {
          todayMeetings,
          avgScore,
          activeUsers,
          weekMeetings,
          completionRate
        },
        trends: {
          dates: trends.map(t => t.date),
          scores: trends.map(t => t.count)
        },
        scoreDistribution: {
          labels: scoreDistribution.map(s => s.score_range),
          data: scoreDistribution.map(s => s.count)
        },
        statusDistribution: {
          labels: statusDistribution.map(s => s.status),
          data: statusDistribution.map(s => s.count)
        },
        platformUsage: {
          labels: platformUsage.map(p => p.platform),
          data: platformUsage.map(p => p.count)
        },
        recentActivity: recentActivity.map(a => ({
          time: a.time,
          meeting: a.meeting || 'Untitled Meeting',
          platform: a.platform || 'Unknown',
          status: a.status || 'unknown'
        }))
      };
    } catch (e) {
      console.error('Error in getDashboardOverview:', e);
      throw e;
    }
  }

  static runSafeQuery(sql) {
    return new Promise((resolve, reject) => {
      if (!sql) return reject(new Error('SQL required'));
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('DROP') || upper.startsWith('ALTER')) return reject(new Error('Dangerous query blocked'));
      if (upper.startsWith('SELECT')) {
        db.all(sql, [], (err, rows) => err ? reject(err) : resolve({ rows }));
      } else {
        db.run(sql, [], function(err) {
          if (err) return reject(err);
          resolve({ changes: this.changes, lastID: this.lastID });
        });
      }
    });
  }

  static exportTable(tableName) {
    return AdminModel.getTableRows(tableName, 0).then(rows => rows);
  }
}

module.exports = AdminModel;
