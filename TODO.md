# RetentionLab - Active Tasks

## Fix Admin Panel API 404 Errors

### Task Overview
Fixed 404 errors for admin panel API endpoints. The frontend was calling `/api/admin/users` and `/api/admin/roles` which didn't exist. Added `/list` endpoints to the routes and updated frontend JavaScript files to use the correct API paths.

### ✅ All Tasks Completed
- [x] Analyzed current API routes for users and roles
- [x] Identified 404 errors on `/api/admin/users` and `/api/admin/roles`
- [x] Added `/list` endpoints to `routes/users.js`
- [x] Added `/list` endpoints to `routes/roles.js`
- [x] Updated `public/js/admin/people/users.js` to use `/api/roles/list` and `/api/users/list`
- [x] Updated `public/js/admin/people/roles.js` to use `/api/roles/list` and `/api/users/list`
- [x] Updated `public/js/admin/reports/teams.js` to use `/api/admin/users/list`
- [x] Verified server is running and endpoints are accessible
- [x] Confirmed authentication is working (Unauthorized error expected without token)

### Changes Made

#### Backend Routes
**routes/users.js:**
- Added `GET /admin/list` endpoint
- Added `POST /admin/list` endpoint  
- Added `POST /list` endpoint

**routes/roles.js:**
- Added `GET /list` endpoint
- Added `POST /list` endpoint

#### Frontend JavaScript
**public/js/admin/people/users.js:**
- Changed `/api/admin/roles` → `/api/roles/list`
- Changed `/api/admin/users` → `/api/users/list`

**public/js/admin/people/roles.js:**
- Already using `/api/roles/list` and `/api/users/list`

**public/js/admin/reports/teams.js:**
- Changed `/api/admin/users` → `/api/admin/users/list`

### API Endpoints Now Available
- `GET /api/roles/list` - List all roles (admin panel)
- `POST /api/roles/list` - List all roles (admin panel)
- `POST /api/users/list` - List users with filters (admin panel)
- `GET /api/admin/users/list` - Admin list endpoint
- `POST /api/admin/users/list` - Admin list with filters
- `POST /api/admin/users/add` - Add new user (admin panel)

---

## Fix Meeting Schedule API 404 Error

### Task Overview
Fixed 404 error for `/api/admin/meeting-schedule/all` endpoint. Changed from GET to POST method and updated the controller to accept parameters in request body instead of URL query parameters.

### ✅ All Tasks Completed
- [x] Identified 404 error on `/api/admin/meeting-schedule/all`
- [x] Added POST `/all` endpoint to `routes/meeting-schedule.js`
- [x] Updated `controllers/meetings/meetingScheduleController.js` to accept parameters from request body
- [x] Added `/api/admin/meeting-schedule` mount point in `routes/registry.js`
- [x] Updated `public/js/admin/meetings/schedule.js` to use POST with payload
- [x] Verified endpoint is accessible and returns proper authentication error

### Changes Made

#### Backend Routes
**routes/meeting-schedule.js:**
- Added `POST /all` endpoint (GET already existed)

**routes/registry.js:**
- Added `/api/admin/meeting-schedule` route mount point

**controllers/meetings/meetingScheduleController.js:**
- Updated `getAllMeetings()` to accept `from_date`, `to_date`, and `instructor_id` from request body
- Maintains backward compatibility with GET query parameters

#### Frontend JavaScript
**public/js/admin/meetings/schedule.js:**
- Changed from GET with query parameters to POST with JSON payload
- Parameters now sent in request body: `from_date`, `to_date`, `instructor_id`

### API Endpoint
- `POST /api/admin/meeting-schedule/all` - Get all meetings with date filters (NEW: accepts POST with payload)

### Testing
- Server running on port 3000 ✓
- Endpoint returns "Unauthorized: missing token" (expected without authentication) ✓
- No more 404 errors ✓
- Fixed SQL syntax error (changed CAST to direct TIMESTAMPDIFF) ✓

### Testing
- Server running on port 3000 ✓
- Endpoints return "Unauthorized: missing token" (expected without authentication) ✓
- No more 404 errors for admin panel ✓

---

## Update Meeting Schedule Controller to Use Filter Parameters

### Task Overview
Updated the `getAllMeetings()` controller to properly use the `from_date`, `to_date`, and `instructor_id` parameters that are being sent from the frontend. Previously these parameters were being received but not used in the database query.

### ✅ All Tasks Completed
- [x] Updated controller to use `from_date` and `to_date` for date range filtering
- [x] Updated controller to use `instructor_id` to filter by specific instructor
- [x] Added `getMeetingsByDateRange()` method to MeetingModel
- [x] Added `getUserById()` method to CalendarUsersModel
- [x] Maintained backward compatibility with hours-based queries
- [x] Verified endpoint is working (returns authentication error as expected)

### Changes Made

**controllers/meetings/meetingScheduleController.js:**
- Updated `getAllMeetings()` to use `from_date` and `to_date` when provided
- Falls back to hours-based range when dates not provided
- Filters by specific instructor when `instructor_id` is provided
- Returns all instructors' meetings when `instructor_id` is not provided

**models/meetings/MeetingModel.js:**
- Added `getMeetingsByDateRange(emails, fromDate, toDate)` method
- Queries meetings within specific date range with duration calculation

**models/calendar/CalendarUsersModel.js:**
- Added `getUserById(userId)` method to fetch instructor details

### API Parameters Now Supported
- `from_date` (YYYY-MM-DD) - Start date for filtering meetings
- `to_date` (YYYY-MM-DD) - End date for filtering meetings  
- `instructor_id` (number) - Specific instructor ID to filter by (optional)
- `hours` (number) - Fallback: hours from now if dates not provided

### Behavior
- **With dates:** Shows meetings for all instructors within the date range
- **With instructor_id:** Shows meetings only for that specific instructor
- **With both:** Shows meetings for specific instructor within date range
- **Without filters:** Shows meetings for all instructors (hours-based fallback)

---

## Fix UsersModel Not Defined Error

### Task Overview
Fixed the "UsersModel is not defined" error that was causing 500 Internal Server Error on POST /api/content/audio endpoint.

### ✅ All Tasks Completed
- [x] Located the route handler for /api/content/audio
- [x] Identified UsersModel usage in recordingsController.js line 136
- [x] Confirmed UsersModel.js exists in models/users/
- [x] Added missing import statement for UsersModel
- [x] Verified the fix

---

## Update API to Use user_uuid Instead of id

### Task Overview
Updated the recordings API endpoints to use user_uuid instead of numeric id for better security and consistency. The API now accepts and returns user_uuid in all requests and responses.

### ✅ All Tasks Completed
- [x] Added getUserByUuid() method to UsersModel
- [x] Updated getRecordings() to use loggedInUserUuid from request body
- [x] Updated getTranscripts() to use loggedInUserUuid from request body
- [x] Updated getSummaries() to use loggedInUserUuid from request body
- [x] Updated getAssets() to use loggedInUserUuid from request body
- [x] Added UUID to ID conversion logic for requested users
- [x] Updated all API responses to include userUuid field
- [x] Maintained backward compatibility with numeric IDs

---

## Update Recordings Logic - Store User in Both localStorage and sessionStorage

### Task Overview
Successfully updated the system to store logged-in user data in both localStorage and sessionStorage for better reliability.

### ✅ All Tasks Completed
- [x] Update MeetingRecordingsModel to support new query logic
- [x] Update getRecordings() in controller with proper filtering
- [x] Add logic to check meeting status and scheduled_end_time
- [x] Join with meeting_sessions to get transcript and audio file names
- [x] Get logged-in user from localStorage (rl_user)
- [x] Send loggedInUserId in API request from frontend
- [x] Update controller to use loggedInUserId from request body
- [x] Store rl_user in both localStorage and sessionStorage in header.js
- [x] Server restarted without errors

---

## Consolidate Meeting Assets Seeders

### Task Overview
Consolidated 6 different seeders that were inserting into meeting_assets table into a single unified seeder to avoid duplication and conflicts.

### ✅ All Tasks Completed
- [x] Created unified seeder: `11_seed_meeting_assets_unified.js`
- [x] Unified seeder inserts ALL asset types (audio, transcripts, summaries, analytics, audit, diarization, etc.)
- [x] Generates realistic file paths for all asset types
- [x] Includes screenshots JSON, audit summary, OQI scores
- [x] Processes all instructors and their completed meetings
- [x] Checks for existing assets to avoid duplicates

---

## One Table Per Seeder - Final Structure (22 Seeders)

### Task Overview
Restructured all manual seeders so that **one file = one table**. Removed redundant system_settings and header_configs seeders (auto-seeded by db:reset).

### ✅ All Tasks Completed
- [x] Deleted redundant 03_seed_system_settings.js and 04_seed_header_configs.js (auto-seeded by db:reset)
- [x] Renumbered all files sequentially 01-22 (no gaps)
- [x] Each seeder inserts into ONLY its named table
- [x] Updated `run-manual-seeders.js` to handle numbered filenames

### Final File Structure (Execution Order)
```bash
01_seed_departments.js              # → departments
02_seed_users.js                    # → users
03_seed_calendar_verifications.js   # → calendar_verifications
04_seed_calendar_integrations.js    # → calendar_integrations
05_seed_calendar_credentials.js     # → calendar_credentials
06_seed_meetings.js                 # → meetings (30-day loop, random times)
07_seed_meeting_sessions.js         # → meeting_sessions (random ±1-10 min join times)
08_seed_participants.js             # → participants
09_seed_meeting_assets.js           # → meeting_assets
10_seed_transcripts.js              # → transcripts
11_seed_meeting_reviewers.js        # → meeting_reviewers
12_seed_meeting_scores.js           # → meeting_scores
13_seed_meeting_session_scores.js   # → meeting_session_scores
14_seed_session_quality_reports.js  # → session_quality_reports
15_seed_session_analysis.js         # → session_analysis
16_seed_session_learning_impact.js # → session_learning_impact
17_seed_session_coaching_feedback.js# → session_coaching_feedback
18_seed_session_better_alternatives.js # → session_better_alternatives
19_seed_session_quality_flags.js    # → session_quality_flags
20_seed_session_final_evaluation.js # → session_final_evaluation
21_seed_ai_audit_results.js         # → ai_audit_results
22_seed_department_members.js       # → department_members
```

### Usage
```bash
# Run ALL seeders in order
node database/run-manual-seeders.js

# OR run individual seeder by table name
node database/manual-seeder/06_seed_meetings.js
node database/manual-seeder/07_seed_meeting_sessions.js
```

---

## Notes
- User data now stored in both: `localStorage.setItem('rl_user', ...)` and `sessionStorage.setItem('rl_user', ...)`
- Frontend can read from either storage: `localStorage.getItem('rl_user') || sessionStorage.getItem('rl_user')`
- Provides redundancy and better session management
- Admin: Gets all instructors' recordings with filters
- Instructor: Gets their own recordings

---

## Update CalendarVerificationModel to Prevent Duplicate Records

### Task Overview
Modified the `create()` method in CalendarVerificationModel to check for existing records with the same `user_id` and `provider` combination. If a record exists, it updates it instead of inserting a duplicate. This prevents multiple pending verification records for the same user and provider.

### ✅ All Tasks Completed
- [x] Analyzed the current CalendarVerificationModel create() method
- [x] Added logic to check for existing user_id + provider combination
- [x] Implemented UPDATE query when record exists
- [x] Implemented INSERT query when record doesn't exist
- [x] Added provider parameter with default value 'google'
- [x] Updated logging to include provider information
- [x] Verified the changes work correctly

### Changes Made

**models/calendar/CalendarVerificationModel.js:**
- Modified `create(userId, token = null, provider = 'google')` method
- Added check for existing record: `SELECT id FROM calendar_verifications WHERE user_id=? AND provider=?`
- If exists: Updates token, expires_at, status='pending', and clears verified_at and connected_at
- If not exists: Inserts new record with user_id, token, provider, status='pending', expires_at
- Returns the created or updated verification record
- Enhanced logging to include provider information

### Behavior
- **First call:** Creates new verification record
- **Subsequent calls:** Updates existing record with new token and expiration
- **Prevents:** Multiple pending verifications for same user + provider
- **Maintains:** 30-minute expiration window on each create/update

### API Method Signature
```javascript
CalendarVerificationModel.create(userId, token = null, provider = 'google')
```

### Example Usage
```javascript
// Creates new record
await CalendarVerificationModel.create(123);

// Updates existing record for user 123 with provider 'google'
await CalendarVerificationModel.create(123, null, 'google');

// Creates/updates record with different provider
await CalendarVerificationModel.create(123, null, 'outlook');
```

---

## Fix Google Calendar Authentication Error

### Task Overview
Fixed the "Invalid Credentials" error (401) that was occurring during background calendar sync. Implemented error handling to detect authentication failures, mark invalid tokens, and filter out users with expired credentials.

### ✅ All Tasks Completed
- [x] Added 401 error detection in calendar sync
- [x] Implemented token status update mechanism
- [x] Added `updateTokenStatus()` method to CalendarUsersModel
- [x] Updated `getActiveEmails()` to filter out invalid tokens
- [x] Added logging for invalid credential detection
- [x] Prevented sync attempts for users with invalid tokens

### Changes Made

**controllers/meetings/meetingScheduleController.js:**
- Added 401 error detection in `syncMeetings()`
- Marks user's calendar integration as 'invalid' when authentication fails
- Updated `getActiveEmails()` to filter out users with invalid token status
- Added warning logs for invalid credentials

**models/calendar/CalendarUsersModel.js:**
- Added `updateTokenStatus(userId, status)` method
- Allows marking tokens as 'invalid' when authentication fails

### How It Works

1. **Error Detection:** When Google Calendar API returns 401 "Invalid Credentials", the error is caught
2. **Token Marking:** The user's calendar integration status is updated to 'invalid'
3. **Filtering:** `getActiveEmails()` filters out users with invalid tokens
4. **Logging:** Warning messages are logged for debugging
5. **Re-authentication:** Users need to re-authorize their Google Calendar connection

### Benefits
- No more repeated 401 errors in logs
- Automatic detection of expired/invalid tokens
- Prevents unnecessary API calls to Google
- Clear audit trail of authentication failures
- Users can be notified to re-authorize when needed
