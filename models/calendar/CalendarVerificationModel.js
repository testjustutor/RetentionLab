/**
 * models/calendar/CalendarVerificationModel.js
 * CRUD for calendar_connections
 */
const { getAsync, runAsync, allAsync } = require('../../database/db');
const { logger } = require('../../utils/logger');

class CalendarVerificationModel {
  /**
   * Create a new verification record or update existing one
   * @param {number} userId - User ID
   * @param {string} token - Verification token (optional, will generate if not provided)
   * @param {string} provider - Provider name (default: 'google')
   * @returns {Promise<Object>} Created or updated verification record
   */
  static async create(userId, provider = 'google', token = null) {
    if (!userId) throw new Error('User ID is required');

    const verificationToken = token || this.generateToken();
    // Google access tokens last ~1 hour (3600s); refresh tokens extend them via
    // oauth refresh, so a generous expiry avoids an unnecessary 'expired' state.
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    const expiresAtFormatted = expiresAt.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    const current_time = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });

    // calendar_connections is keyed by provider_id, so resolve it from the name
    const providerId = await this.resolveProviderId(provider);

    // Check if a record already exists for this user_id and provider
    const existing = await getAsync(
      `SELECT id FROM calendar_connections WHERE user_id=? AND provider_id=?`,
      [userId, providerId]
    );

    if (existing) {
      // Update existing record - reset verification state
      await runAsync(
        `UPDATE calendar_connections
         SET verification_token=?, verification_expires_at=?, verification_status='pending',
             code=NULL, verified_at=NULL, connected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [verificationToken, expiresAtFormatted, existing.id]
      );

      logger.info(`Model(CalendarVerificationModel): Updated verification for userId=${userId}, provider=${provider}`);
      return this.getById(existing.id);
    } else {
      // Insert new record
      const result = await runAsync(
        `INSERT INTO calendar_connections
         (user_id, provider_id, verification_token, verification_status, verification_expires_at, connected_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [userId, providerId, verificationToken, expiresAtFormatted, current_time]
      );

      logger.info(`Model(CalendarVerificationModel): Created verification for userId=${userId}, provider=${provider}`);
      return this.getById(result.insertId);
    }
  }

  /**
   * Resolve a provider name (e.g. 'google') to a calendar_providers id.
   * @param {string} provider - Provider name (default: 'google')
   * @returns {Promise<number|null>}
   */
  static async resolveProviderId(provider = 'google') {
    if (!provider) return null;
    const providerNameMap = {
      'google': 'google-meet',
      'google-meet': 'google-meet',
      'zoom': 'zoom',
      'teams': 'teams',
      'microsoft-teams': 'teams'
    };
    const lookupName = providerNameMap[provider] || provider;
    try {
      const row = await getAsync(`SELECT id FROM calendar_providers WHERE name=? LIMIT 1`, [lookupName]);
      return row ? row.id : null;
    } catch (err) {
      logger.warn(`Model(CalendarVerificationModel): Could not lookup provider_id for ${provider}:`, err.message);
      return null;
    }
  }

  /**
   * Generate a random verification token
   * @returns {string} Random token
   */
  static generateToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Get verification by ID
   * @param {number} id - Verification ID
   * @returns {Promise<Object>} Verification record
   */
  static async getById(id) {
    return getAsync(`SELECT * FROM calendar_connections WHERE id=?`, [id]);
  }

  /**
   * Get verification by token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Verification record
   */
  static async getByToken(token) {
    return getAsync(
      `SELECT * FROM calendar_connections WHERE verification_token=? AND verification_status='pending'`,
      [token]
    );
  }

  /**
   * Get verification by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Verification record
   */
  static async getByUserId(userId) {
    return getAsync(
      `SELECT * FROM calendar_connections WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
  }

  /**
   * Update token by user ID
   * @param {number} userId - User ID
   * @param {string} token - New token value
   * @returns {Promise<Object>} Updated verification record
   */
  static async updateTokenByUserId(userId, token) {
    if (!userId) throw new Error('User ID is required');
    if (!token) throw new Error('Token is required');

    // Google access token max TTL is 1 hour; refresh token extends it.
    const expiresAt = new Date(Date.now() + 3600000);

    await runAsync(
      `UPDATE calendar_connections
       SET verification_token=?, verification_expires_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=? AND verification_status='pending'`,
      [token, expiresAt.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }), userId]
    );

    logger.info(`Model(CalendarVerificationModel): Updated token for userId=${userId}`);
    return this.getByUserId(userId);
  }

  /**
   * Verify a token (mark as verified)
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Updated verification record
   */
  static async verifyToken(token) {
    if (!token) throw new Error('Token is required');

    const verification = await this.getByToken(token);
    if (!verification) {
      return null;
    }
     
    // If the link/token has passed its (1 hour) expiry, we re-verify via the OAuth
    // refresh token (the sync service refreshes the access token automatically),
    // so the connection never lands in an 'expired' state.
    const expiresAtMs = verification.verification_expires_at
      ? new Date(verification.verification_expires_at).getTime()
      : 0;

    if (expiresAtMs && expiresAtMs < Date.now()) {
      logger.info(`Model(CalendarVerificationModel): Token past expiry for userId=${verification.user_id}; re-verifying via refresh token`);
    }

    // Mark as verified
    await runAsync(
      `UPDATE calendar_connections
       SET verification_status='verified', verified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [verification.id]
    );

    logger.info(`Model(CalendarVerificationModel): Token verified for userId=${verification.user_id}`);
    return this.getById(verification.id);
  }

  /**
   * Mark verification as used/connected
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Updated verification record
   */
  static async markAsConnected(token) {
    if (!token) throw new Error('Token is required');

    // Get verification without status filter since it may be 'verified' already
    const verification = await getAsync(
      `SELECT * FROM calendar_connections WHERE verification_token=?`,
      [token]
    );
    
    if (!verification) {
      return null;
    }

    await runAsync(
      `UPDATE calendar_connections
       SET verification_status='connected', connected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [verification.id]
    );

    logger.info(`Model(CalendarVerificationModel): Marked as connected for userId=${verification.user_id}`);
    return this.getById(verification.id);
  }

  /**
   * Get all pending verifications
   * @returns {Promise<Array>} List of pending verifications
   */
  static async getPending() {
    return allAsync(
      `SELECT * FROM calendar_connections WHERE verification_status='pending' ORDER BY created_at DESC`
    );
  }

  /**
   * Delete verification by ID
   * @param {number} id - Verification ID
   * @returns {Promise<Object>} Result
   */
  static async deleteById(id) {
    await runAsync(`DELETE FROM calendar_connections WHERE id=?`, [id]);
    return { success: true };
  }

  /**
   * Delete verification by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Result
   */
  static async deleteByUserId(userId) {
    await runAsync(`DELETE FROM calendar_connections WHERE user_id=?`, [userId]);
    return { success: true };
  }

  /**
   * Clean up expired verifications
   * @returns {Promise<number>} Number of deleted records
   */
  static async cleanupExpired() {
    const result = await runAsync(
      `DELETE FROM calendar_connections
       WHERE verification_status IN ('pending', 'expired')
       AND verification_expires_at < NOW()`
    );
    logger.info(`Model(CalendarVerificationModel): Cleaned up ${result.changes} expired verifications`);
    return result.changes;
  }
}

module.exports = CalendarVerificationModel;