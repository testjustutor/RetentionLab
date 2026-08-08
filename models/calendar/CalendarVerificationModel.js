/**
 * models/calendar/CalendarVerificationModel.js
 * CRUD for calendar_verifications
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
  static async create(userId, provider , token = null ) {
    if (!userId) throw new Error('User ID is required');
    
    const verificationToken = token || this.generateToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    const expiresAtFormatted = expiresAt.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    const current_time = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    // Check if a record already exists for this user_id and provider

    const existing = await getAsync(
      `SELECT id FROM calendar_verifications WHERE user_id=? AND provider=?`,
      [userId, provider]
    );

    if (existing) {
      // Update existing record - reset verification state
      await runAsync(
        `UPDATE calendar_verifications
         SET token=?, expires_at=?, status='pending',
             code=NULL, verified_at=NULL, connected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [verificationToken, expiresAtFormatted, existing.id]
      );

      logger.info(`Model(CalendarVerificationModel): Updated verification for userId=${userId}, provider=${provider}`);
      return this.getById(existing.id);
    } else {
      // Insert new record
      const result = await runAsync(
        `INSERT INTO calendar_verifications
         (user_id, token, provider, status, expires_at, connected_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [userId, verificationToken, provider, expiresAtFormatted, current_time]
      );

      logger.info(`Model(CalendarVerificationModel): Created verification for userId=${userId}, provider=${provider}`);
      return this.getById(result.insertId);
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
    return getAsync(`SELECT * FROM calendar_verifications WHERE id=?`, [id]);
  }

  /**
   * Get verification by token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Verification record
   */
  static async getByToken(token) {
    return getAsync(
      `SELECT * FROM calendar_verifications WHERE token=? AND status='pending'`,
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
      `SELECT * FROM calendar_verifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,
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

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    await runAsync(
      `UPDATE calendar_verifications
       SET token=?, expires_at=?, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=? AND status='pending'`,
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
     
    const new_data =  new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
     
    // Check if expired
    if (verification.expires_at && new Date(verification.expires_at) < new Date(new_data)) {
      // Mark as expired
      await runAsync(
        `UPDATE calendar_verifications SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [verification.id]
      );
      return { ...verification, expired: true };
    }

    // Mark as verified
    await runAsync(
      `UPDATE calendar_verifications
       SET status='verified', verified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
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
      `SELECT * FROM calendar_verifications WHERE token=?`,
      [token]
    );
    
    if (!verification) {
      return null;
    }

    await runAsync(
      `UPDATE calendar_verifications
       SET status='connected', connected_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
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
      `SELECT * FROM calendar_verifications WHERE status='pending' ORDER BY created_at DESC`
    );
  }

  /**
   * Delete verification by ID
   * @param {number} id - Verification ID
   * @returns {Promise<Object>} Result
   */
  static async deleteById(id) {
    await runAsync(`DELETE FROM calendar_verifications WHERE id=?`, [id]);
    return { success: true };
  }

  /**
   * Delete verification by user ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Result
   */
  static async deleteByUserId(userId) {
    await runAsync(`DELETE FROM calendar_verifications WHERE user_id=?`, [userId]);
    return { success: true };
  }

  /**
   * Clean up expired verifications
   * @returns {Promise<number>} Number of deleted records
   */
  static async cleanupExpired() {
    const result = await runAsync(
      `DELETE FROM calendar_verifications
       WHERE status IN ('pending', 'expired')
       AND expires_at < NOW()`
    );
    logger.info(`Model(CalendarVerificationModel): Cleaned up ${result.changes} expired verifications`);
    return result.changes;
  }
}

module.exports = CalendarVerificationModel;