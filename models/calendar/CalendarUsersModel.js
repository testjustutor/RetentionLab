/**
 * root/models/CalendarUsersModel.js
 */
const { getAsync, runAsync, allAsync, db } = require('../../database/db');
const { logger } = require('../../utils/logger');

// Small promisified wrappers matching the MySQL shim's callback style
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) return reject(err);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

class CalendarUsersModel {
  static createTable() {
    // Tables already exist in MySQL - skip creation
    logger.info('Model(CalendarUsersModel): Tables verified (creation skipped for MySQL)');
    return Promise.resolve(0);
  }

  static async createOrUpdateUserCalendar(userId, tokens) {
    if (!userId) throw new Error('Missing userId');
    const { access_token, refresh_token, expiry_date, provider = 'google', provider_id = null } = tokens;

    // If provider_id is not provided, try to look it up from calendar_providers
    let finalProviderId = provider_id;
    if (!finalProviderId && provider) {
      try {
        // Map common provider names to calendar_providers.name values
        const providerNameMap = {
          'google': 'google-meet',
          'google-meet': 'google-meet',
          'zoom': 'zoom',
          'teams': 'teams',
          'microsoft-teams': 'teams'
        };
        const lookupName = providerNameMap[provider] || provider;
        const providerResult = await getAsync(`SELECT id FROM calendar_providers WHERE name = ? LIMIT 1`, [lookupName]);
        if (providerResult) {
          finalProviderId = providerResult.id;
        }
      } catch (err) {
        logger.warn(`Model(CalendarUsersModel): Could not lookup provider_id for ${provider}:`, err.message);
      }
    }

    const tokenExpiry = expiry_date
      ? new Date(expiry_date).toLocaleString('sv-SE', {
          timeZone: 'Asia/Kolkata'
        })
      : new Date(Date.now() + 3600000).toLocaleString('sv-SE', {
          timeZone: 'Asia/Kolkata'
        });

    // Check if a row already exists for this user+provider
    const existing = await getAsync(
      `SELECT id FROM calendar_connections WHERE user_id = ? AND provider_id = ? LIMIT 1`,
      [userId, finalProviderId]
    );
    
    let result;
    if (existing) {
      const sql = `UPDATE calendar_connections
         SET provider_id = ?, access_token = ?,
             refresh_token = COALESCE(?, refresh_token),
             token_expires_at = ?, connection_status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`;
     const params = [
          finalProviderId, 
          access_token, 
          refresh_token || null, 
          tokenExpiry, 
          existing.id
        ]
    
        result = await runAsync(sql, params);
      } else {

        const sql = `
          INSERT INTO calendar_connections (user_id, provider_id, access_token, refresh_token, token_expires_at, connection_status)
          VALUES (?, ?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
            provider_id = VALUES(provider_id),
            access_token = VALUES(access_token),
            refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
            token_expires_at = VALUES(token_expires_at),
            connection_status = 'active',
            updated_at = CURRENT_TIMESTAMP
        `;
        const params = [
          userId,
          finalProviderId,
          access_token,
          refresh_token || null,
          tokenExpiry
        ];
      result = await runAsync(sql, params);
    }
    logger.info(`Model(CalendarUsersModel): Calendar integration upserted for user_id: ${userId}, provider: ${provider}, provider_id: ${finalProviderId}`);
    return { id: result.lastID || null, user_id: userId, changes: result.changes };
  }

  static async getUser(userId) {
    if (!userId) throw new Error('Missing userId');
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT ci.*, u.email, u.first_name, u.last_name, u.status as user_status, cp.name as provider
        FROM calendar_connections ci
        JOIN users u ON u.id = ci.user_id
        LEFT JOIN calendar_providers cp ON cp.id = ci.provider_id
        WHERE ci.user_id = ?
      `, [userId], (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integration:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getUserByEmail(email) {
    if (!email) throw new Error('Missing email');
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT ci.*, u.email, u.first_name, u.last_name, u.status as user_status, cp.name as provider
        FROM calendar_connections ci
        LEFT JOIN users u ON u.id = ci.user_id
        LEFT JOIN calendar_providers cp ON cp.id = ci.provider_id
        WHERE u.email = ?
      `, [email], (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integration by email:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static async getUserById(userId) {
    if (!userId) throw new Error('Missing userId');
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT ci.*, u.email, u.first_name, u.last_name, u.status as user_status, u.role_id, r.role_name, cp.name as provider
        FROM calendar_connections ci
        LEFT JOIN users u ON u.id = ci.user_id
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN calendar_providers cp ON cp.id = ci.provider_id
        WHERE u.user_uuid = ?
      `, [userId], (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integration by user ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all calendar integrations with optional filtering.
   * @param {Object} options
   * @param {number|null} options.createdBy - Filter by users created by this admin ID
   * @param {string[]|null} options.roles - Filter by role names (e.g., ['instructor', 'reviewer'])
   * @param {boolean} options.excludeSelf - Exclude the admin user themselves
   * @param {number|null} options.adminId - The admin's user ID to exclude from results
   */
  static async getAllUsers({ createdBy = null, roles = null, excludeSelf = false, adminId = null, status = null } = {}) {
    return new Promise((resolve, reject) => {
      const conditions = [];
      const params = [];

      // Always filter for active users
      conditions.push('users.status = ?');
      params.push('active');

      // Filter by users created by a specific admin
      if (createdBy) {
        conditions.push('users.created_by = ?');
        params.push(createdBy);
      }

      // Filter by role names (e.g., only instructors and reviewers)
      if (roles && roles.length > 0) {
        const placeholders = roles.map(() => '?').join(',');
        conditions.push(`roles.role_name IN (${placeholders})`);
        params.push(...roles);
      }

      // Exclude the admin user themselves
      if (excludeSelf && adminId) {
        conditions.push('users.id != ?');
        params.push(adminId);
      }

      // Filter by calendar integration status (applied after LEFT JOIN)
      if (status) {
        conditions.push('(ci.connection_status = ? OR ci.connection_status IS NULL)');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const sql = `
        SELECT 
          ci.*, 
          users.id AS user_id_ref, 
          users.email, 
          users.first_name, 
          users.last_name, 
          users.role_id, 
          users.user_uuid, 
          users.is_active, 
          roles.role_display_name,
          cp.display_name
        FROM users
        JOIN roles ON roles.id = users.role_id
        LEFT JOIN calendar_connections ci ON ci.user_id = users.id
        LEFT JOIN calendar_providers cp ON cp.id = ci.provider_id
        ${whereClause}
        ORDER BY users.id DESC
      `;

      db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching calendar integrations:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Fetched ${rows.length} calendar integrations`);
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get users whose calendar is connected. Only users whose calendar_connections
   * row has all of: access_token, refresh_token, token_expires_at,
   * connection_status='active', and verification_token are returned.
   * verification_status may be 'verified' OR 'expired' - an expired verification
   * is still synced (the refresh token proves the connection is valid) and gets
   * re-marked 'verified' after a successful refresh.
   * @returns {Promise<Array>} unique connected users (one row per user)
   */
  static async getConnectedUsers() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ci.user_id AS user_id, u.email, ci.access_token, ci.refresh_token, ci.token_expires_at
        FROM calendar_connections ci
        JOIN users u ON u.id = ci.user_id
        WHERE ci.access_token IS NOT NULL
          AND ci.refresh_token IS NOT NULL
          AND ci.token_expires_at IS NOT NULL
          AND ci.connection_status = 'active'
          AND ci.verification_token IS NOT NULL
          AND ci.verification_status IN ('verified', 'expired')
          AND u.status = 'active'
      `;
      db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error fetching connected users:', err);
          return reject(err);
        }
        // Dedupe by user_id (a user may have multiple provider rows)
        const seen = new Set();
        const unique = [];
        for (const r of rows || []) {
          if (!seen.has(r.user_id)) { seen.add(r.user_id); unique.push(r); }
        }
        resolve(unique);
      });
    });
  }

  /**
   * Re-mark a user's calendar verification as 'verified' (used after a
   * successful token refresh, proving the connection is still valid).
   * @param {string} email - user email
   * @returns {Promise<Object>}
   */
  static async markVerifiedByEmail(email) {
    if (!email) return { changes: 0 };
    return runAsync(
      `UPDATE calendar_connections cc
       JOIN users u ON u.id = cc.user_id
       SET cc.verification_status = 'verified', cc.updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(u.email) = LOWER(?) AND cc.verification_status = 'expired'`,
      [email]
    );
  }

  static updateTokens(userId, tokens) {
    if (!userId) throw new Error('Missing userId');
    return new Promise((resolve, reject) => {
      const { access_token, refresh_token, expiry_date } = tokens;
      db.run(`
        UPDATE calendar_connections SET
          access_token = ?,
          refresh_token = ?,
          token_expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [access_token, refresh_token || null, expiry_date, userId], function(err) {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error updating calendar tokens:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Calendar tokens refreshed for user_id: ${userId}, changes: ${this.changes}`);
          resolve({ changes: this.changes, user_id: userId });
        }
      });
    });
  }

  static deleteUser(userId) {
    if (!userId) throw new Error('Missing userId');
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM calendar_connections WHERE user_id = ?', [userId], function(err) {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error deleting calendar integration:', err);
          reject(err);
        } else {
          logger.info(`Model(CalendarUsersModel): Calendar integration deleted for user_id: ${userId}, changes: ${this.changes}`);
          resolve({ changes: this.changes, user_id: userId });
        }
      });
    });
  }

  /**
   * Get the count of truly connected calendars by checking
   * calendar_connections, users, and roles tables.
   * A calendar is considered "connected" when:
   *  - calendar_connections.status = 'active'
   *  - calendar_connections has valid access_token or token_expires_at
   *  - user is active (users.status = 'active')
   *  - user has an instructor-type role (instructor, solo_instructor)
   *  - user was created by the logged-in admin (users.created_by = adminId)
   *
   * @param {number|null} adminId - The logged-in admin's user ID. If null, skip admin filter.
   */
  static async getConnectedCalendarCount(adminId = null) {
    return new Promise((resolve, reject) => {
      const conditions = [
        `ci.connection_status = 'active'`,
        `ci.user_id IS NOT NULL`,
        `(ci.access_token IS NOT NULL OR ci.token_expires_at IS NOT NULL)`,
        `u.status = 'active'`,
        `r.role_name IN ('instructor', 'solo_instructor')`
      ];
      const params = [];

      if (adminId) {
        conditions.push(`u.created_by = ?`);
        params.push(adminId);
      }

      const sql = `
        SELECT COUNT(DISTINCT ci.user_id) AS count
        FROM calendar_connections ci
        JOIN users u ON u.id = ci.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE ${conditions.join(' AND ')}
      `;
      db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Model(CalendarUsersModel): Error counting connected calendars:', err);
          reject(err);
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  }

  /**
   * Update token status (e.g., mark as 'invalid' when authentication fails)
   * @param {number} userId - The user ID
   * @param {string} status - The status to set ('active', 'invalid', etc.)
   */
  static async updateTokenStatus(userId, status) {
    if (!userId) return;
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE calendar_connections SET connection_status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [status, userId],
        function(err) {
          if (err) {
            logger.error(`Model(CalendarUsersModel): Error updating token status for user ${userId}:`, err);
            reject(err);
          } else {
            logger.info(`Model(CalendarUsersModel): Updated token status to '${status}' for user ${userId}, changes: ${this.changes}`);
            resolve({ changes: this.changes, user_id: userId, status });
          }
        }
      );
    });
  }
}

module.exports = CalendarUsersModel;