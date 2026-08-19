/**
 * root/database/seeders/007_settings.js
 * Seeds system and user settings
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const SETTINGS_BY_GROUP = {
  organization: [
    { setting_key: 'company_timezone', setting_value: 'Asia/Kolkata' },
    { setting_key: 'company_locale', setting_value: 'en-IN' },
    { setting_key: 'default_meeting_platform', setting_value: 'zoom' },
    { setting_key: 'support_email', setting_value: 'support@retentionlab.local' },
    { setting_key: 'support_phone', setting_value: '' },
  ],
  platforms: [
    { setting_key: 'platforms.zoom.enabled', setting_value: 'true' },
    { setting_key: 'platforms.zoom.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.zoom.base_url', setting_value: 'https://us05web.zoom.us/wc/' },
    { setting_key: 'platforms.zoom.requires_passcode', setting_value: 'true' },
    { setting_key: 'platforms.zoom.auto_enable_captions', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.enabled', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.google-meet.base_url', setting_value: 'https://meet.google.com/' },
    { setting_key: 'platforms.google-meet.auto_join', setting_value: 'true' },
    { setting_key: 'platforms.google-meet.auto_enable_captions', setting_value: 'true' },
    { setting_key: 'platforms.teams.enabled', setting_value: 'false' },
    { setting_key: 'platforms.teams.bot_name', setting_value: 'RetentionLab Bot' },
    { setting_key: 'platforms.teams.base_url', setting_value: 'https://teams.live.com/meet/' },
    { setting_key: 'platforms.teams.auto_join', setting_value: 'false' },
    { setting_key: 'platforms.teams.auto_enable_captions', setting_value: 'false' },
    { setting_key: 'recording.audio_recording', setting_value: 'true' },
    { setting_key: 'recording.video_recording', setting_value: 'true' },
    { setting_key: 'recording.transcript_recording', setting_value: 'true' },
    { setting_key: 'video_processing.enabled', setting_value: 'true' },
    { setting_key: 'video_processing.convert_to_mp3', setting_value: 'true' },
    { setting_key: 'video_processing.auto_process', setting_value: 'false' },
    { setting_key: 'video_processing.show_mp3_check', setting_value: 'true' },
  ],
  access_control: [
    // Changed default to 'false': instructor accounts get elevated access
    // (reviewing, scoring, meeting data), so self-registration into that
    // role should be an explicit admin opt-in, not a shipped default.
    { setting_key: 'allow_instructor_self_registration', setting_value: 'false' },
    { setting_key: 'allow_guest_access', setting_value: 'false' },
    { setting_key: 'allow_reviewer_assignment', setting_value: 'true' },
    { setting_key: 'allow_score_editing_after_submit', setting_value: 'false' },
    { setting_key: 'allow_meeting_deletion', setting_value: 'false' },
    { setting_key: 'allow_transcript_download', setting_value: 'true' },
    { setting_key: 'allow_audio_download', setting_value: 'true' },
    { setting_key: 'allow_report_export', setting_value: 'true' },
    { setting_key: 'require_admin_approval_for_new_users', setting_value: 'false' },
    { setting_key: 'session_auto_logout_minutes', setting_value: '60' },
  ],
  notifications: [
    { setting_key: 'notify_on_meeting_completed', setting_value: 'true' },
    { setting_key: 'notify_on_review_assigned', setting_value: 'true' },
    { setting_key: 'notify_on_score_submitted', setting_value: 'true' },
    { setting_key: 'notify_on_transcript_ready', setting_value: 'true' },
    { setting_key: 'notify_on_error', setting_value: 'true' },
    { setting_key: 'notify_on_failed_upload', setting_value: 'true' },
    { setting_key: 'digest_frequency', setting_value: 'weekly' },
    { setting_key: 'digest_delivery_time', setting_value: '09:00' },
    { setting_key: 'notification_channels', setting_value: JSON.stringify(['email', 'in_app']) },
  ],
};

const ROLE_DEFAULTS = {
  super_admin: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '50' },
    { setting_key: 'privacy_mode', setting_value: 'standard' },
  ],
  admin: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '25' },
    { setting_key: 'digest_frequency', setting_value: 'daily' },
    { setting_key: 'default_review_mode', setting_value: 'manual' },
  ],
  reviewer: [
    { setting_key: 'default_dashboard_view', setting_value: 'meetings' },
    { setting_key: 'default_items_per_page', setting_value: '25' },
    { setting_key: 'privacy_mode', setting_value: 'strict' },
    { setting_key: 'captions_enabled', setting_value: 'true' },
  ],
  instructor: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '10' },
    { setting_key: 'privacy_mode', setting_value: 'strict' },
    { setting_key: 'show_tips', setting_value: 'true' },
  ],
};

const flattenSettings = (groups) => Object.values(groups).flat();

const upsertSetting = async (tableName, idColumn, targetId, setting) => {
  const isNullTarget = targetId === null || targetId === undefined;
  const whereClause = isNullTarget
    ? `${idColumn} IS NULL AND setting_key = ?`
    : `${idColumn} = ? AND setting_key = ?`;
  const whereParams = isNullTarget ? [setting.setting_key] : [targetId, setting.setting_key];

  const existing = await getAsync(
    `SELECT id FROM ${tableName} WHERE ${whereClause} LIMIT 1`,
    whereParams
  );

  if (existing) {
    const updateColumns = ['setting_value = ?'];
    const updateValues = [setting.setting_value];

    if (setting.setting_type) {
      updateColumns.push('setting_type = ?');
      updateValues.push(setting.setting_type);
    }

    if (setting.editable_by_role) {
      updateColumns.push('editable_by_role = ?');
      updateValues.push(setting.editable_by_role);
    }

    if (typeof setting.is_static === 'boolean') {
      updateColumns.push('is_static = ?');
      updateValues.push(setting.is_static ? 1 : 0);
    }

    updateColumns.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(existing.id);

    await runAsync(
      `UPDATE ${tableName}
       SET ${updateColumns.join(', ')}
       WHERE id = ?`,
      updateValues
    );
    return;
  }

  const columns = [idColumn, 'setting_key', 'setting_value'];
  const values = isNullTarget
    ? [null, setting.setting_key, setting.setting_value]
    : [targetId, setting.setting_key, setting.setting_value];

  if (setting.setting_type) {
    columns.push('setting_type');
    values.push(setting.setting_type);
  }

  if (setting.editable_by_role) {
    columns.push('editable_by_role');
    values.push(setting.editable_by_role);
  }

  if (typeof setting.is_static === 'boolean') {
    columns.push('is_static');
    values.push(setting.is_static ? 1 : 0);
  }

  const placeholders = columns.map(() => '?').join(', ');

  await runAsync(
    `INSERT INTO ${tableName} (${columns.join(', ')}, created_at, updated_at)
     VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    values
  );
};

/**
 * Seed system-wide settings (global defaults)
 * @async
 * @returns {Promise<void>}
 */
const seedSystemSettings = async () => {
  console.log('[Seed] Starting system settings seed...');

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM system_settings`);
  if (count > 0) {
    console.log(`[Seed] System settings already seeded (${count} records found), skipping...`);
    return; // already seeded, skip
  }

  const systemSettings = flattenSettings(SETTINGS_BY_GROUP);

  console.log(`[Seed] Seeding ${systemSettings.length} system settings...`);

  for (const setting of systemSettings) {
    await upsertSetting('system_settings', 'company_id', null, setting);
  }

  console.log(`[Seed] ✓ System settings seeded successfully`);
};

/**
 * Seed user-specific default settings based on role
 * This is idempotent - safe to re-run any number of times.
 * Only inserts missing settings; never modifies or duplicates existing ones.
 * @async
 * @returns {Promise<void>}
 */
const seedUserSettings = async () => {
  console.log('[Seed] Starting user settings seed...');

  const users = await allAsync(
    `SELECT users.id, roles.role_name
     FROM users
     LEFT JOIN roles ON roles.id = users.role_id`
  );

  console.log(`[Seed] Seeding user-specific settings for ${users.length} users...`);

  let totalInserted = 0;

  for (const user of users || []) {
    // Get defaults for this user's role (if any)
    const roleDefaults = ROLE_DEFAULTS[user.role_name] || [];
    
    for (const setting of roleDefaults) {
      // upsertSetting is idempotent: it checks if the setting already exists
      // and only inserts if missing. This makes it safe to re-run.
      await upsertSetting('user_settings', 'user_id', user.id, setting);
      totalInserted++;
    }
  }

  console.log(`[Seed] ✓ User settings seeded successfully (${totalInserted} settings processed)`);
};

/**
 * Seed system-wide settings and user-specific default settings
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If database operation fails
 */
const seedSettings = async () => {
  // System settings and user settings are now independent
  // System settings: seeded once, skipped if already present
  await seedSystemSettings();
  
  // User settings: always runs, but is idempotent (safe to re-run)
  // This allows new roles/users to get their defaults without full re-seed
  await seedUserSettings();
};

module.exports = {
  seedSettings,
  SETTINGS_BY_GROUP,
  ROLE_DEFAULTS,
};

// Run seeder if executed directly
if (require.main === module) {
  seedSettings()
    .then(() => {
      console.log('[Seed] ✓ Settings seeder completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] ✗ Settings seeder failed:', err);
      process.exit(1);
    });
}
