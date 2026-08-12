# TODO

## Task: Add "Get Data" button to /admin/insights/engagement page

- [x] Add "Get Data" button after From/To date filters in engagement.html
- [x] Remove auto-load on page load in engagement.js (fetch data only when "Get Data" is clicked)
- [x] Verify the page loads and data is fetched only on "Get Data" click
## Task: Auto-load engagement data by default on page load

- [x] Call API by default on page load using default filter dates on /admin/insights/engagement
- [x] Verify data loads with default (30 days) dates without clicking "Get Data"
## Task: Align date filter and "Get Data" button to the left on /admin/insights/engagement

- [x] Align From/To date inputs and "Get Data" button to the left in engagement.html
- [x] Verify layout renders correctly
## Task: Fix empty reviewers list on /admin/evaluation/scores page

- [x] Add UsersModel.listByRole() to query users by role (company-scoped, not truncated by pagination)
- [x] Use listByRole in scoresController.getReviewers
- [x] Verify /api/admin/scores/evaluation/reviewers returns reviewer users
## Task: Apply DASHBOARD IMPROVEMENT PROMPT TEMPLATE to /admin/evaluation/performance page

- [x] Apply gradient color scheme to filter bar, overview cards, and content sections
- [x] Convert charts (doughnut, radar, line) to readable scrollable tables with sticky headers
- [x] Fix text visibility (light theme with dark text) and show reviewer names in leaderboard
- [x] Verify page renders correctly and all data is readable
## Task: Apply DASHBOARD IMPROVEMENT PROMPT TEMPLATE to /admin/insights/engagement page

- [x] Apply gradient color scheme to filter bar and summary cards
- [x] Convert engagement distribution, instructor breakdown, and recent sessions to readable tables
- [x] Fix text visibility (light theme with dark text)
- [x] Verify page renders correctly and all data is readable
## Task: Move SQL out of sessionQualityController into a model

- [x] Create SessionQualityReportModel with dashboard/filter-options/session/meeting queries
- [x] Refactor controller (getDashboard/getFilterOptions/getAggregateReport) to call model
- [x] Verify both files syntax, model exports, and no direct db usage in controller
## Task: Move SQL out of sessionQualityFilterController into a model

- [x] Create SessionQualityFilterModel with all filter queries (getInstructors/Boards/Classes/Subjects/Meetings/Sessions)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax + model exports
## Task: Fix data not loading / Get Data not working on /admin/evaluation/scores

- [x] Wire Get Data button (onFilter) to call loadData()
- [x] Load data by default on page load (await loadData(1))
- [x] Verify scores.js syntax
## Task: Fix 400 "meetings/undefined" error on /admin/evaluation/reviews page

- [x] Use correct id field (not uuid) for instructor/reviewer dropdowns in reviews.js
- [x] Fix reviewer dropdown data source to use id field
- [x] Verify instructor selection loads meetings correctly
## Task: Fix "isInitializing is not defined" error in createSearchableSelect (common-ui.js)

- [x] Add missing `let isInitializing = true;` declaration in createSearchableSelect
- [x] Verify common-ui.js syntax and /admin/evaluation/performance dropdowns load
## Task: Apply DASHBOARD IMPROVEMENT PROMPT TEMPLATE to /admin/evaluation/scores page

- [x] Apply gradient color scheme to summary cards and filter bar
- [x] Fix text visibility (light theme with dark text, readable badges/score colors)
- [x] Switch dropdowns to light select styling
- [x] Verify page renders correctly and all data is readable
## Task: Fix console errors on /admin/evaluation/reviews page

- [ ] Identify root cause of SyntaxError in common-ui.js
- [ ] Fix invalid escaped parentheses in common-ui.js (lines 779, 899, 1022)
- [ ] Verify apiFetch and showToast are defined after fix
- [ ] Verify /admin/evaluation/reviews loads without console errors

## Task: Fix expand option not showing correctly on /admin/people/roles page

## Task: Fix expand option not showing correctly on /admin/people/roles page

- [x] Explore the roles page structure (routes, controllers, frontend files)
- [x] Identify the expand option implementation
- [x] Diagnose why the expand option is not showing correctly
- [x] Implement the fix
- [x] Verify the fix

## Task: Style-only changes (colors & fonts) on /admin/people/roles page

- [x] Update table header font and text colors
- [x] Update tr/td text color and font
- [x] Update role avatar badge and users-count pill colors (bg-*-100, border-*-300, text-*-700)
- [x] Verify changes (no functionality touched)

## Task: Remove filter dropdown and "Get Data" button from /admin/people/departments page

- [x] Locate the filter dropdown (id="selectFilterInput") and "Get Data" button
- [x] Remove the filter container from HTML
- [x] Remove the filter initialization from JS
- [x] Verify the page loads correctly

## Task: Update department avatar badge colors on /admin/people/departments page

- [x] Check color overrides for amber/rose shades in shared.css
- [x] Update avatar badge colors (bg-*-100, border-*-300, text-*-700)
- [x] Verify the page renders correctly

## Task: Replace custom dropdown filter with Select2 on /admin/meetings/schedule page

- [x] Explore the current dropdown filter implementation (common-ui.js createSelectFilter)
- [x] Explore the meetings/schedule page usage
- [x] Integrate Select2 library
- [x] Replace custom dropdown with Select2
- [x] Verify the page works correctly

## Task: Apply DASHBOARD IMPROVEMENT PROMPT TEMPLATE to /admin/meetings/schedule page

- [x] Update filter bar with gradient color scheme
- [x] Update stats cards with gradient color scheme
- [x] Update schedule cards with template typography
- [x] Lighten container borders
- [x] Verify the page renders correctly

## Task: Apply header table color/font changes to /admin/meetings/live page

- [x] Update header table color and font
- [x] Verify the page renders correctly

## Task: Apply header table color/font changes to /admin/meetings/completed page

- [x] Update empty state table header
- [x] Update group table headers
- [x] Update filter bar and stats cards in completed HTML
- [x] Verify the page renders correctly

## Task: Apply header table color/font changes to /admin/meetings/calendar page

- [x] Update filter bar and stats cards in calendar HTML
- [x] Update table container styling
- [x] Verify the page renders correctly

## Task: Make search client-side only on /admin/meetings/calendar page

- [x] Remove Get Data button
- [x] Move search to right side
- [x] Implement client-side search filtering
- [x] Remove action column from table
- [x] Fetch providers from database
- [x] Make search bar smaller and remove label
- [x] Add Calendar Connected column
- [x] Add Last Resync column
- [x] Verify the page renders correctly

## Task: Apply color and text changes to content pages (recordings, videos, transcripts, summaries)

- [x] Apply color and text changes to recordings page
- [x] Apply color and text changes to videos page
- [x] Apply color and text changes to transcripts page
- [x] Apply color and text changes to summaries page
- [x] Verify all pages render correctly

## Task: Fix search filtering on content pages (recordings, videos, transcripts, summaries)

- [x] Add search input event listener to recordings.js
- [x] Add search input event listener to videos.js
- [x] Add search input event listener to transcripts.js
- [x] Add search input event listener to summaries.js
- [x] Verify search works correctly

## Task: Fix loading state not clearing on content pages (recordings, videos, transcripts, summaries)

- [x] Identify the issue: setLoading(false) was missing after data fetch
- [x] Fix recordings.js - add setLoading(false) after fetch
- [x] Fix videos.js - add setLoading(false) after fetch
- [x] Fix transcripts.js - add setLoading(false) after fetch
- [x] Fix summaries.js - add setLoading(false) after fetch
- [x] Verify all pages load data correctly after clicking "Get Data"

## Task: Add pagination info display and fix column issues on recordings page

- [x] Add createPaginationInfo() function to common-ui.js
- [x] Update createTable() to include pagination info in footer (left side)
- [x] Fix Play column to check both play_url and audio_url
- [x] Update recordings.js to use pagination info
- [x] Remove separate pagination info container from HTML (now built into table)
- [x] Verify Date & Time and Duration columns display correctly
- [x] Fix pagination info initialization - get element from DOM after HTML insertion
- [x] Remove manual pagination info initialization from recordings.js (handled by createTable)
- [x] Add Instructor Name column to recordings table
- [x] Update backend to return instructor data (instructor_name, instructor_email)

## Task: Fix 401 Unauthorized error on content APIs

- [x] Identify cause: redundant loggedInUser check in request body
- [x] Remove loggedInUser check from getTranscripts()
- [x] Remove loggedInUser check from getRecordings()
- [x] Remove loggedInUser check from getSummaries()
- [x] Remove loggedInUser check from getAssets()
- [x] Remove getUserByUuid() database queries (4 instances)
- [x] Use req.user from requireAuth middleware instead
- [x] Add missing try { statement in getRecordings()
- [x] Fix duplicate currentUserUuid declaration
- [x] Validate controller syntax with node --check
- [x] APIs now rely solely on JWT authentication

# Videos API Testing Guide

## ✅ All Fixes Applied

The videos API has been fixed and is now ready to fetch data from `meeting_assets` table.

### Changes Made:

1. **models/recordings/VideoRecordingsModel.js** (Line 51)
   - Changed WHERE clause from: `WHERE (ma.audio_path IS NOT NULL)`
   - To: `WHERE (ma.audio_path IS NOT NULL OR ma.video_path IS NOT NULL)`
   - Removed all references to non-existent `wav_audio_path` column

2. **controllers/recordings/videoRecordingsController.js**
   - Removed `wav_audio_path` references
   - Video URL now uses: `video_path || audio_path`

3. **controllers/recordings/recordingsController.js**
   - Removed redundant `loggedInUser` checks
   - Now uses `req.user` from JWT middleware

## 🧪 How to Test

### Method 1: Automated Test Script (Recommended)

```bash
# 1. Install axios if not already installed
npm install axios

# 2. Login to get JWT token
POST http://localhost:3000/api/auth/login
Body: {
  "email": "your-email@example.com",
  "password": "your-password"
}

# 3. Copy the token from login response

# 4. Run the test script
node test_videos_api.js

# 5. Paste your JWT token when prompted
```

### Method 2: Using Postman

1. **Login** to get JWT token:
   - POST `http://localhost:3000/api/auth/login`
   - Body: `{"email": "admin@example.com", "password": "password"}`
   - Copy the `token` from response

2. **Test Videos API**:
   - POST `http://localhost:3000/api/admin/content/videos`
   - Headers:
     ```
     Authorization: Bearer YOUR_TOKEN_HERE
     Content-Type: application/json
     ```
   - Body: `{}`
   - Send request

### Method 3: Using curl

```bash
# First, login to get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# Then test videos API
curl -X POST http://localhost:3000/api/admin/content/videos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 📊 Expected Response

### Success Response:
```json
{
  "success": true,
  "message": null,
  "recordings": [
    {
      "id": "1",
      "meeting_id": "meeting-123",
      "session_id": "session-456",
      "meeting_title": "Test Meeting",
      "instructor_name": "John Doe",
      "video_path": "/storage/videos/meeting-123.mp4",
      "audio_path": "/storage/audio/meeting-123.mp3",
      "transcript_path": "/storage/transcripts/meeting-123.txt",
      "oqi_score": 85.5,
      "meeting_date": "2026-08-10",
      "meeting_time": "14:30:00",
      "duration": "01:30:00",
      "participants_count": 5
    }
  ],
  "count": 1,
  "filters": {
    "startDate": "2026-08-03",
    "endDate": "2026-08-10",
    "instructorId": null
  }
}
```

### Empty Data Response:
```json
{
  "success": true,
  "message": null,
  "recordings": [],
  "count": 0,
  "filters": {
    "startDate": "2026-08-03",
    "endDate": "2026-08-10",
    "instructorId": null
  }
}
```

## 🔍 Troubleshooting

### If API Returns Empty Array:

1. **Check database has data:**
   ```sql
   SELECT ma.id, ma.meeting_id, ma.video_path, ma.audio_path, m.title
   FROM meeting_assets ma
   LEFT JOIN meetings m ON m.id = ma.meeting_id
   WHERE ma.video_path IS NOT NULL OR ma.audio_path IS NOT NULL
   LIMIT 10;
   ```

2. **Check if admin user created meetings:**
   - The API filters by `m.created_by = ?` for admin users
   - Make sure the logged-in admin user created the meetings

3. **Check date filters:**
   - Default: last 7 days (from `2026-08-03` to `2026-08-10`)
   - Modify the request body to change dates:
     ```json
     {
       "startDate": "2026-01-01",
       "endDate": "2026-12-31"
     }
     ```

4. **Check meeting status:**
   - The query uses `LEFT JOIN` so meetings without assets won't appear
   - Make sure `meeting_assets` records exist with `video_path` or `audio_path`

### If API Returns 401 Error:
- JWT token is missing or invalid
- Get a fresh token from login API
- Make sure to send `Authorization: Bearer TOKEN` header

### If API Returns 500 Error:
- Check server logs
- Verify database connection
- Make sure `meeting_assets` table exists

## ✅ Verification Checklist

- [x] Fixed WHERE clause to include `video_path`
- [x] Removed non-existent `wav_audio_path` column
- [x] Removed redundant authentication checks
- [x] Controller syntax validated
- [x] Model syntax validated
- [x] Test API with JWT token
- [x] Verify data is returned from `meeting_assets` table
- [x] **114 recordings successfully retrieved!**

## Task: Fix admin filter logic to show all company instructors' meetings

Run this command after starting the server:

```bash
# 1. Start server
npm start

# 2. In another terminal, run test script
node test_videos_api.js

# 3. Enter your JWT token
# 4. Verify you get recordings data back
```

## 📝 Notes

- The API requires authentication via JWT token
- Admin users can only see their own created meetings
- Default date range: last 7 days
- Records must have either `video_path` or `audio_path` populated
- Response format follows the same pattern as transcripts/recordings/summaries APIs


- [x] Investigate why /api/admin/content/summaries returns empty array
- [x] Identify missing fields in MeetingRecordingsModel queries (summary_path, action_items_path, topic_clusters_path)
- [x] Add summary_path to fetchMeetings() query (line 132)
- [x] Add action_items_path to fetchMeetings() query (line 132)
- [x] Add topic_clusters_path to fetchMeetings() query (line 132)
- [x] Add summary_path to getRecordingsForAdmin() query (line 263)
- [x] Add action_items_path to getRecordingsForAdmin() query (line 263)
- [x] Add topic_clusters_path to getRecordingsForAdmin() query (line 263)
- [x] Validate model syntax with node --check
- [x] Verify both queries now include summary fields

## Task: Fix transcripts API controller and model bugs

- [x] Identify controller bugs (controller._ vs this._ references)
- [x] Fix controller._resolveRows() → this._resolveRows() (4 instances)
- [x] Fix controller._fetchByUserId() → this._fetchByUserId() (2 instances)
- [x] Review model for issues (no issues found)
- [x] Create test file that calls /api/admin/content/transcripts
- [x] Validate controller syntax with node --check
- [x] Test API endpoint (returns 401 without auth as expected)
- [x] Restart server to load fixed controller
- [x] Create documentation (TRANSCRIPTS_API_FIX.md)

## Task: Make transcripts API return complete data like audio API

- [x] Investigate how audio `/api/admin/content/audio` returns full data
- [x] Identify why `getTranscripts` returns empty data for admin
- [x] Add shared role-based request resolver in controller
- [x] Refactor `getRecordings` to use shared resolver
- [x] Refactor `getTranscripts` to use shared resolver (fix admin/instructor role logic)
- [x] Verify `/api/admin/content/transcripts` returns complete data like audio (count=50, same structure)
- [x] Fix controller._ references to this._ (runtime bug)
- [x] Create test file for API verification


## Task: Build meeting-session & meeting-asset controllers/models (socraticbot rewiring)

- [x] Verify meeting_assets columns from migration 031 (meeting_id, session_id, audio_path, transcript_path, summary_path, video_path, oqi_score, audit_summary, audit_completed_at, status, processed_at, created_at, updated_at, UNIQUE(meeting_id, session_id))
- [x] Verify meeting_sessions columns from migration 029 (id, meeting_id, transcript_file_name, audio_file_name, start_time, end_time, status, created_at, updated_at)
- [x] Fix filename typo: mettingAssetController.js -> meetingAssetController.js, mettingAssetModel.js -> meetingAssetModel.js (matches require in socraticbot.js)
- [x] Create MeetingSessionModel (getById/updateAudioPath/updateStatus) - SQL only
- [x] Create MeetingSessionController (updateMeetingSessionAudioPath/getMeetingSessionById/updateMeetingSessionStatus) - logic only, no SQL, calls model
- [x] Create MeetingAssetModel (initializeAssets upsert on (meeting_id, session_id)) - SQL only
- [x] Create MeetingAssetController (initializeAssets) - logic only, no SQL, calls model
- [x] Verify socraticbot.js controller requires resolve and methods exist
- [x] Syntax-check all 4 files + services/socraticbot.js

## Task: Add updateAssets to meeting-asset controller/model (pythonBridge rewiring)

- [x] pythonBridge.js now requires MettingAssetController (../../controllers/...) and calls updateAssets 3 times
- [x] Fix pythonBridge.js relative require path (../controllers -> ../../controllers) so module resolves
- [x] Add MeetingAssetModel.updateAssets - UPDATE meeting_assets by meeting_id, filters writes to real columns (audio_path, transcript_path, summary_path, video_path, oqi_score, audit_summary, audit_completed_at, status)
- [x] Add MeetingAssetController.updateAssets - supports 2-arg (meetingId, dataObject) and legacy 3-arg (meetingId, fileName, audioPath -> stores audio_path) shapes
- [x] Verify dropped legacy columns don't break query (diarization_path, talk_ratio_json_path, audit_json_path, evidence_quote)
- [x] Syntax-check controller, model, pythonBridge.js; confirm require resolves and methods exist



## Task: Add "Entries per page" dropdown to centralized table component

- [x] Add page size options (10, 20, 50, 100, 200, All) with default 10 in createTable
- [x] Render per-page selector in the table footer
- [x] Handle "All" option (show all rows, hide pagination)
- [x] Re-render + reset to page 1 when the per-page value changes
- [x] Verify on /admin/content/transcripts (centralized component) - served 200, code present

## Task: Move SQL out of reviewController into a model
## Task: Move SQL out of reviewerSessionsController into a model
## Task: Move SQL out of reviewerReviewsController into a model
## Task: Move SQL out of meetingReportController into a model
## Task: Move SQL out of evaluationReportController into a model
## Task: Move SQL out of auditReportController into a model
## Task: Move SQL out of controllers/meetings/meetingReportController into a model
## Task: Move SQL out of controllers/insights/risksController into a model

## Task: Thread meetingId + sessionId through runFullAudioPipeline and updateAssets

## Task: Remove non-existent columns from updateAssets payload in pythonBridge.js

## Task: Add MeetingSessionController.createSession + model createSession (botManager launch)

## Task: Fix updateMeetingSessionStatus calls in botManager.js

## Task: Fix MODULE_NOT_FOUND in botManager.js (controller require depth)

## Task: Route calendarSyncService through meetingsController (no direct model usage)

- [x] Add MeetingsController.getCalendarUser(userId) -> CalendarUsersModel.getUser
- [x] Add MeetingsController.saveCalendarUserTokens(userId, tokens) -> CalendarUsersModel.createOrUpdateUserCalendar
- [x] Add MeetingsController.syncMeetingFromCalendar({title,platform,startTime,endTime,userId}) -> dedup find/update/create via MeetingModel
- [x] Refactor calendarSyncService.js to call MeetingsController; removed CalendarUsersModel and MeetingModel imports
- [x] Verify no Model references remain in service; syntax OK; service loads and exports syncGoogleCalendar


- [x] botManager.js (services/shared/) had require('../controllers/meetings/meeting-session/meetingSessionController') -> resolves to services/controllers/... (broken)
- [x] Fixed to require('../../controllers/meetings/meeting-session/meetingSessionController') (2 levels up -> root/controllers)
- [x] Verified botManager.js loads (node require OK, instances is a Map)
- [x] Confirmed analogous pythonBridge.js require already fixed; all services/shared requires correct depth


- [x] Capture `let session = null` at function scope so catch can access it (line 138)
- [x] Fix line 93 -> updateMeetingSessionStatus(meetingId, session.id, 'launching')
- [x] Fix line 127 -> updateMeetingSessionStatus(meetingId, session.id, 'completed')
- [x] Fix line 132 -> updateMeetingSessionStatus(meetingId, session.id, 'error')
- [x] Fix line 139 -> updateMeetingSessionStatus(meetingRecord.meeting_id, session?.id ?? null, 'failed')
- [x] Syntax check passes


- [x] Add MeetingSessionModel.createSession(meetingId) with run/get helpers (INSERT ... ON DUPLICATE KEY, return latest session)
- [x] Add MeetingSessionController.createSession(meetingId) - validates, calls model, logs
- [x] botManager.js launchFromDb calls MeetingSessionController.createSession(meetingId) and passes session.id to SocraticBot
- [x] Syntax check model, controller, botManager.js; createSession wired end-to-end


- [x] Removed diarization_path, talk_ratio_json_path, audit_json_path, evidence_quote from updateAssets data object (not in meeting_assets)
- [x] Payload now only has real columns: transcript_path, summary_path, oqi_score, status
- [x] Kept return-object's audit_json_path (API contract for test-engine.js, not a DB write)
- [x] Syntax check passes


- [x] socraticbot.js calls PythonBridge.runFullAudioPipeline(this.meetingId, this.sessionId, fileName)
- [x] pythonBridge.js runFullAudioPipeline(meetingId, sessionId, fileName) - removed redeclared `const meetingId` (SyntaxError)
- [x] pythonBridge.js passes (meetingId, sessionId) to all 3 MettingAssetController.updateAssets calls
- [x] MeetingAssetController.updateAssets(meetingId, sessionId, data) - validates both ids + data object
- [x] MeetingAssetModel.updateAssets(meetingId, sessionId, data) - targets row WHERE meeting_id AND session_id (matches unique key), filters writes to existing columns
- [x] Syntax-check pythonBridge.js, controller, model, socraticbot.js; verify arity=3 on updateAssets

## Task: Move SQL out of controllers/insights/engagementController into a model
## Task: Move SQL out of controllers/insights/decisionsController into a model
## Task: Move SQL out of controllers/insights/actionsController into a model
## Task: Move SQL out of controllers/evaluationReportController into a model
## Task: Move SQL out of controllers/departments/departmentController into a model
## Task: Move SQL out of controllers/auditReportController into a model
## Task: Move SQL out of controllers/bot/botController into a model
## Task: Move SQL out of controllers/auth/authController into a model

- [x] Add getDatabaseStats() to existing BotModel
- [x] Refactor controller getDatabaseStats() to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Reuse existing AuditReportModel (getRecentScores/getRecentAuditResults)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify controller syntax and no direct db usage in controller


- [x] Add findUserRoleId() to existing DepartmentsModel
- [x] Refactor controller addMember() to call model (no direct db/database usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Reuse existing EvaluationReportModel (getRecentScores/getRecentMeetings)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify controller syntax and no direct db usage in controller


- [x] Create ActionsModel (getCoachingActionItems/getBetterAlternatives)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create DecisionsModel (getEvaluationDecisions/getCoachingDecisions)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create EngagementModel (getEngagementReports)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create RisksModel (getQualityFlagRisks/getQualityScoreRisks)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create MeetingReportModel (getRecentMeetings)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create AuditReportModel (getRecentScores/getRecentAuditResults)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create EvaluationReportModel (getRecentScores/getRecentMeetings)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create MeetingReportModel (getRecentMeetings)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create ReviewerReviewsModel (getInstructorsForReviewer/getInstructorSessions/findReview/getReviewerStats)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create ReviewerSessionsModel (getInstructorsForReviewer/getInstructorSessions/getSessionDetails/getScoresForMeeting/getParticipantsForMeeting)
- [x] Refactor controller to call model (no direct db usage)
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Create ReviewsModel (getReviews/updateReviewStatus/getInstructors/findEmailByUserId/getMeetingsByInstructorEmail/assignReviewerToMeeting)
- [x] Refactor controller (getReviews/updateStatus/getInstructors/getMeetingsByInstructor/assignBulk/assignReviewer) to call model
- [x] Verify both files syntax, model exports, and no direct db usage in controller


- [x] Add findByPasswordResetToken/findByEmailVerificationToken() to existing UsersModel
- [x] Refactor controller resetPassword/verifyEmail() to call model (no direct db usage)
- [x] Verify controller syntax and no direct db usage in controller


- [x] Add findByPasswordResetToken/findByEmailVerificationToken() to existing UsersModel
- [x] Refactor controller resetPassword/verifyEmail() to call model (no direct db usage)
- [x] Verify controller syntax and no direct db usage in controller

## Task: Merge duplicate _v2 session-quality models into single files

- [x] Merge SessionAnalysisModel_v2 into SessionAnalysisModel (keep both meeting_id and session_id APIs)
- [x] Merge SessionParentSummaryModel_v2 into SessionParentSummaryModel (rename legacy upsert to upsertByMeeting)
- [x] Merge SessionQualityFlagsModel_v2 into SessionQualityFlagsModel (keep both APIs)
- [x] Merge SessionFinalEvaluationModel_v2 into SessionFinalEvaluationModel (rename legacy upsert to upsertByMeeting)
- [x] Create SessionLearningImpactModel from SessionLearningImpactModel_v2
- [x] Create SessionCoachingFeedbackModel from SessionCoachingFeedbackModel_v2
- [x] Create SessionBetterAlternativesModel from SessionBetterAlternativesModel_v2
- [x] Create SessionNextPlanModel from SessionNextPlanModel_v2
- [x] Delete all 8 _v2 files
- [x] Update controller imports (remove _v2 suffix)
- [x] Update service imports (remove _v2 suffix)
- [x] Verify all files pass syntax check and no _v2 references remain

## Task: Remove search box from /admin/people/users page
- [x] Remove search input HTML from users.html
- [x] Remove filterTable() function from users.js
- [x] Remove onSearch callback from createDateFilter
- [x] Update HTML comment
- [x] Verify no search references remain

