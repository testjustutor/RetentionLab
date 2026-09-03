/**
 * Manual Seeder: teacher_coaching_feedback + teacher_better_alternatives
 * Seeds data for the admin Actions insights page (/admin/insights/actions),
 * which reads from these two tables joined to meetings + users.
 * Run command: node database/manual-seeder/23_seed_teacher_actions.js
 */
const { runAsync, getAsync, allAsync } = require('../seedHelpers');

const seedTeacherActions = async () => {
  console.log('[Manual Seeder] Starting teacher actions seeder...');
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUser = await getAsync(
      `SELECT u.id, u.company_id FROM users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
      [adminEmail]
    );
    if (!adminUser) { console.log('[Manual Seeder] ⚠ Admin user not found.'); process.exit(1); }

    // Only seed meetings that join to a user in the admin's company (so they display)
    const meetings = await allAsync(
      `SELECT m.id
       FROM meetings m
       JOIN users u ON LOWER(u.email) = LOWER(m.calendar_account)
       WHERE u.company_id = ? AND u.status = 'active'
       LIMIT 20`,
      [adminUser.company_id]
    );
    if (meetings.length === 0) {
      console.log('[Manual Seeder] ℹ No meetings found for instructor users.');
      return;
    }

    const areas = ['Engagement', 'Clarification', 'Pacing', 'Questioning', 'Feedback'];
    const actions = [
      'Use more targeted follow-up questions to check student understanding.',
      'Incorporate more interactive activities to boost engagement.',
      'Slow down the pace and confirm comprehension before moving on.',
      'Provide clearer examples to support the explanation.',
      'Encourage participation by calling on students individually.'
    ];
    const situations = [
      'Students appeared disengaged during the explanation portion.',
      'Several students did not answer when prompted.',
      'The instructor moved quickly through a complex topic.',
      'Few students asked clarifying questions.',
      'The session lacked a clear summary at the end.'
    ];
    const alternatives = [
      'Pause and ask each student a quick check-in question.',
      'Use breakout rooms or polls to foster discussion.',
      'Revisit the previous concept before introducing new material.',
      'Break the topic into smaller, digestible chunks.',
      'End the session with a recap and next-step questions.'
    ];

    let cfCount = 0;
    let baCount = 0;

    for (const meeting of meetings) {
      // ---- teacher_coaching_feedback ----
      const existingCf = await getAsync(
        `SELECT id FROM teacher_coaching_feedback WHERE meeting_id = ? LIMIT 1`,
        [meeting.id]
      );
      if (!existingCf) {
        const area = areas[cfCount % areas.length];
        const action = actions[cfCount % actions.length];
        await runAsync(
          `INSERT INTO teacher_coaching_feedback
           (meeting_id, feedback_type, area, evidence, why_it_matters, recommended_action, created_at)
           VALUES (?, 'coaching', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            meeting.id,
            area,
            `Observed issue with ${area.toLowerCase()} during the session.`,
            `Improving ${area.toLowerCase()} will increase student outcomes.`,
            action
          ]
        );
        cfCount++;
      }

      // ---- teacher_better_alternatives ----
      const existingBa = await getAsync(
        `SELECT id FROM teacher_better_alternatives WHERE meeting_id = ? LIMIT 1`,
        [meeting.id]
      );
      if (!existingBa) {
        const situation = situations[baCount % situations.length];
        const alternative = alternatives[baCount % alternatives.length];
        await runAsync(
          `INSERT INTO teacher_better_alternatives
           (meeting_id, transcript_situation, current_approach, better_alternative, purpose, created_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [
            meeting.id,
            situation,
            'Current teaching approach used in the session.',
            alternative,
            'To improve student comprehension and engagement.'
          ]
        );
        baCount++;
      }
    }

    console.log(`[Manual Seeder] ✓ Created ${cfCount} teacher_coaching_feedback`);
    console.log(`[Manual Seeder] ✓ Created ${baCount} teacher_better_alternatives`);
  } catch (err) {
    console.error('[Manual Seeder] ✗ teacher actions seeder failed:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedTeacherActions()
    .then(() => { console.log('\n[Manual Seeder] Process completed.'); process.exit(0); })
    .catch(err => { console.error('[Manual Seeder] Fatal error:', err); process.exit(1); });
}

module.exports = { seedTeacherActions };
