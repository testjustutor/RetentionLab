/**
 * root/database/settingsSeeder.js
 */
const { runAsync, getAsync, allAsync } = require('./seedHelpers');
const appConfig = require('../config/settings');

const SETTINGS_BY_GROUP = {
  system: [
    {
      setting_key: 'puppeteer',
      setting_value: JSON.stringify(appConfig.puppeteer),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'audio',
      setting_value: JSON.stringify(appConfig.audio),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'screen',
      setting_value: JSON.stringify(appConfig.screen),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'paths',
      setting_value: JSON.stringify(appConfig.paths),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'platforms',
      setting_value: JSON.stringify(appConfig.platforms),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'google',
      setting_value: JSON.stringify(appConfig.google),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'webhookUrl',
      setting_value: appConfig.webhookUrl || '',
      setting_type: 'string',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'HF_TOKEN',
      setting_value: appConfig.HF_TOKEN || '',
      setting_type: 'string',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'ai',
      setting_value: JSON.stringify(appConfig.ai),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'pipeline_features',
      setting_value: JSON.stringify(appConfig.pipeline_features),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
    {
      setting_key: 'services',
      setting_value: JSON.stringify(appConfig.services),
      setting_type: 'json',
      editable_by_role: 'super_admin,admin',
    },
  ],
  organization: [
    { setting_key: 'company_timezone', setting_value: 'Asia/Kolkata' },
    { setting_key: 'company_locale', setting_value: 'en-IN' },
    { setting_key: 'default_meeting_platform', setting_value: 'zoom' },
    { setting_key: 'default_retention_policy_days', setting_value: '365' },
    { setting_key: 'support_email', setting_value: 'support@retentionlab.local' },
    { setting_key: 'support_phone', setting_value: '' },
  ],
  access_control: [
    { setting_key: 'allow_instructor_self_registration', setting_value: 'true' },
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
  workflow: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_meeting_status', setting_value: 'joining' },
    { setting_key: 'default_review_status', setting_value: 'pending' },
    { setting_key: 'default_sort_order', setting_value: 'created_at_desc' },
    { setting_key: 'default_items_per_page', setting_value: '25' },
    { setting_key: 'default_review_mode', setting_value: 'manual' },
    { setting_key: 'auto_assign_reviewer', setting_value: 'false' },
    { setting_key: 'auto_generate_summary', setting_value: 'true' },
    { setting_key: 'auto_generate_action_items', setting_value: 'true' },
    { setting_key: 'auto_tag_topics', setting_value: 'true' },
  ],
  ai_analysis: [
    { setting_key: 'ai_provider', setting_value: 'groq' },
    { setting_key: 'ai_model', setting_value: 'gemini-2.0-flash' },
    { setting_key: 'ai_temperature', setting_value: '0.2' },
    { setting_key: 'ai_max_tokens', setting_value: '2048' },
    { setting_key: 'ai_enabled', setting_value: 'true' },
    { setting_key: 'summary_enabled', setting_value: 'true' },
    { setting_key: 'topic_clustering_enabled', setting_value: 'true' },
    { setting_key: 'sentiment_analysis_enabled', setting_value: 'true' },
    { setting_key: 'action_item_extraction_enabled', setting_value: 'true' },
    { setting_key: 'speaker_diarization_enabled', setting_value: 'true' },
    { setting_key: 'confidence_threshold', setting_value: '0.75' },
    { setting_key: 'hallucination_check_enabled', setting_value: 'true' },
  ],
  media_capture: [
    { setting_key: 'audio_capture_enabled', setting_value: 'true' },
    { setting_key: 'video_capture_enabled', setting_value: 'false' },
    { setting_key: 'transcription_enabled', setting_value: 'true' },
    { setting_key: 'captions_enabled', setting_value: 'true' },
    { setting_key: 'capture_language', setting_value: 'en' },
    { setting_key: 'output_audio_format', setting_value: 'mp3' },
    { setting_key: 'output_transcript_format', setting_value: 'json' },
    { setting_key: 'retention_audio_quality', setting_value: 'high' },
    { setting_key: 'record_screen_enabled', setting_value: 'false' },
    { setting_key: 'record_chat_enabled', setting_value: 'true' },
  ],
  user_preferences: [
    { setting_key: 'theme', setting_value: 'system' },
    { setting_key: 'language', setting_value: 'en' },
    { setting_key: 'timezone', setting_value: 'Asia/Kolkata' },
    { setting_key: 'date_format', setting_value: 'DD/MM/YYYY' },
    { setting_key: 'time_format', setting_value: '24h' },
    { setting_key: 'first_day_of_week', setting_value: 'monday' },
    { setting_key: 'notifications_enabled', setting_value: 'true' },
    { setting_key: 'email_notifications', setting_value: 'true' },
    { setting_key: 'sms_notifications', setting_value: 'false' },
    { setting_key: 'desktop_notifications', setting_value: 'true' },
    { setting_key: 'sound_enabled', setting_value: 'true' },
    { setting_key: 'email_digest_frequency', setting_value: 'weekly' },
    { setting_key: 'items_per_page', setting_value: '25' },
    { setting_key: 'auto_refresh_interval', setting_value: '60' },
    { setting_key: 'sidebar_collapsed', setting_value: 'false' },
    { setting_key: 'show_tips', setting_value: 'true' },
    { setting_key: 'privacy_mode', setting_value: 'standard' },
    { setting_key: 'transcript_auto_save', setting_value: 'true' },
    { setting_key: 'summary_auto_generate', setting_value: 'true' },
    { setting_key: 'capture_preferences', setting_value: JSON.stringify({
      media_extraction: true,
      transcription: true,
      intel_extraction: true,
      ai_audit: true,
      summary_generation: true,
      topic_clustering: true,
    }) },
  ],
};

const ROLE_DEFAULTS = {
  super_admin: [
    { setting_key: 'default_dashboard_view', setting_value: 'overview' },
    { setting_key: 'default_items_per_page', setting_value: '50' },
    { setting_key: 'ai_provider', setting_value: 'groq' },
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

const buildRoleSettings = (baseSettings, roleSettings = []) => {
  const merged = new Map();

  for (const setting of baseSettings) {
    merged.set(setting.setting_key, setting);
  }

  for (const setting of roleSettings) {
    merged.set(setting.setting_key, {
      ...merged.get(setting.setting_key),
      ...setting,
    });
  }

  return Array.from(merged.values());
};

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

  const placeholders = columns.map(() => '?').join(', ');

  await runAsync(
    `INSERT INTO ${tableName} (${columns.join(', ')}, created_at, updated_at)
     VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    values
  );
};

const seedSettings = async () => {

  const { count } = await getAsync(`SELECT COUNT(*) as count FROM system_settings`);
  if (count > 0) return; // already seeded, skip

  const systemSettings = flattenSettings({
    system: SETTINGS_BY_GROUP.system,
    organization: SETTINGS_BY_GROUP.organization,
    access_control: SETTINGS_BY_GROUP.access_control,
    notifications: SETTINGS_BY_GROUP.notifications,
    workflow: SETTINGS_BY_GROUP.workflow,
    ai_analysis: SETTINGS_BY_GROUP.ai_analysis,
    media_capture: SETTINGS_BY_GROUP.media_capture,
  });

  for (const setting of systemSettings) {
    await upsertSetting('system_settings', 'company_id', null, setting);
  }

  const users = await allAsync(
    `SELECT users.id, roles.role_name
     FROM users
     LEFT JOIN roles ON roles.id = users.role_id`
  );

  for (const user of users || []) {
    const baseUserSettings = SETTINGS_BY_GROUP.user_preferences;
    const roleDefaults = ROLE_DEFAULTS[user.role_name] || [];
    const mergedSettings = buildRoleSettings(baseUserSettings, roleDefaults);

    for (const setting of mergedSettings) {
      const { setting_type, editable_by_role, ...userSetting } = setting;
      await upsertSetting('user_settings', 'user_id', user.id, setting);
    }
  }
};

module.exports = { seedSettings, SETTINGS_BY_GROUP, ROLE_DEFAULTS };