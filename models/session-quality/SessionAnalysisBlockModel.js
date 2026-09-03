/**
 * root/models/SessionAnalysisBlockModel.js
 * Single-row-per-session analysis block
 */
const { db } = require('../../database/db');
const { logger } = require('../../utils/logger');

class SessionAnalysisBlockModel {
  static upsert(data) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO session_analysis (session_id, what_worked_well, what_needs_improvement, missed_opportunities, created_at, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE 
        what_worked_well=VALUES(what_worked_well), 
        what_needs_improvement=VALUES(what_needs_improvement), 
        missed_opportunities=VALUES(missed_opportunities), 
        updated_at=CURRENT_TIMESTAMP`;
      
      const params = [
        data.session_id,
        JSON.stringify(data.what_worked_well || []),
        JSON.stringify(data.what_needs_improvement || []),
        JSON.stringify(data.missed_opportunities || [])
      ];
      
      db.run(sql, params, function(err) {
        if (err) { 
          logger.error('[SessionAnalysisBlockModel] upsert error', err); 
          return reject(err); 
        }
        resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static getBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM session_analysis WHERE session_id = ? LIMIT 1`;
      db.get(sql, [sessionId], (err, row) => {
        if (err) { 
          logger.error('[SessionAnalysisBlockModel] getBySession error', err); 
          return reject(err); 
        }
        if (row) {
          // Parse JSON fields
          try {
            row.what_worked_well = JSON.parse(row.what_worked_well || '[]');
            row.what_needs_improvement = JSON.parse(row.what_needs_improvement || '[]');
            row.missed_opportunities = JSON.parse(row.missed_opportunities || '[]');
          } catch (e) {
            logger.warn('[SessionAnalysisBlockModel] JSON parse error', e);
          }
        }
        resolve(row || null);
      });
    });
  }

  static deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM session_analysis WHERE session_id = ?`;
      db.run(sql, [sessionId], function(err) {
        if (err) { 
          logger.error('[SessionAnalysisBlockModel] deleteBySession error', err); 
          return reject(err); 
        }
        resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = SessionAnalysisBlockModel;</arg_value>
<task_progress>
- [x] Explore existing tutoring routes (aggregate endpoint already exists)
- [x] Explore existing report pages and meeting list
- [x] Add meeting selector to session-quality page
- [x] Update session-quality.js to load meetings and handle selection
- [x] Create reports dashboard landing page
- [x] Create reports.js for dashboard stats
- [x] Create meeting report controller
- [x] Create evaluation report controller
- [x] Create evaluation report route
- [x] Mount new routes in index.js
- [x] Update meetings.js to use new controller endpoint
- [x] Update evaluations.js to use new controller endpoint
- [x] Update audits.js to properly handle filters
- [x] Test all report pages
- [x] Create shared CSS for session quality reports
- [x] Create report hub/index page
- [x] Create rubric page and JS
- [x] Create analysis page and JS
- [x] Create impact page and JS
- [x] Create parent-summary page and JS
- [x] Create coaching page and JS
- [x] Create better-alternatives page and JS
- [x] Create next-plan page and JS
- [x] Create flags page and JS
- [x] Create final-eval page and JS
- [x] Update seeder with new report pages
- [x] Update aggregate endpoint with professional response format
- [x] Fix seeder require paths
- [x] Fix seeder column names to match actual schema
- [x] Insert sample data into database
- [x] Test navigation and data flow
- [x] Fix seeder to insert new pages without skipping
- [x] Verify sidebar menu shows new pages
- [x] Move pages to correct location (public/admin/reports/)
- [x] Update page keys to match URL structure
- [x] Update reports.html links to point to session-quality/index.html
- [x] Add session quality links to meetings page
- [x] Add session quality link to audits page
- [x] Reorganize sidebar menu: split Reports into two parts
- [x] Re-run seeder to apply changes
- [x] Copy JS files to admin/reports/session-quality path
- [x] Update HTML references to new JS paths
- [x] Move session-quality out of reports to own folder
- [x] Update sidebar menu hrefs to new path
- [x] Restructure hub page to use standard admin layout
- [x] Restructure all 9 section pages to use standard admin layout
- [x] Re-run seeder
- [x] Update all JS file references from /js/admin/reports/session-quality/ to /js/admin/session-quality/
- [x] Remove Session Quality buttons from all report pages
- [x] Verify sidebar menu in database
- [x] Remove numbers from session quality submenu labels
- [x] Add check-circle icon to sidebar.js for Session Quality menu
- [x] Clear sidebar cache and verify icon displays
- [x] Remove migration files
- [x] Add schema creation to rubricSeeder.js
- [x] Fix SQL syntax error in rubricSeeder.js
- [x] Run seeder successfully
- [ ] Create SessionAnalysisBlockModel
- [ ] Create SessionLearningImpactBlockModel
- [ ] Create SessionParentSummaryBlockModel
- [ ] Create SessionCoachingFeedbackBlockModel
- [ ] Create SessionBetterAlternativesBlockModel
- [ ] Create SessionNextPlanBlockModel
- [ ] Create SessionQualityFlagsBlockModel
- [ ] Create SessionFinalEvaluationBlockModel
- [ ] Create SessionSnapshotModel
- [ ] Update tutoring.js routes
- [ ] Create generation pipeline
</parameter>
</task_progress>