## Task: /admin/reports/teams — Team Performance Comparison chart text too light → dark

- [x] Chart text was very light violet (`#e9d5ff` legend, `#c4b5fd` ticks) on a dark `bg-slate-900` card. To make text dark without becoming invisible, switched the chart card to a light blue/cyan theme (matches audits/meetings charts).
- [x] HTML: chart card `bg-slate-900` → `bg-gradient-to-br from-blue-50 to-cyan-100 border-2 border-blue-200`; heading `text-violet-600` → `text-blue-900`.
- [x] JS: legend `#e9d5ff` → `#1e3a8a`; axis ticks `#c4b5fd` → `#334155` (dark slate, x/y/y1); grid `#475569` → `#e2e8f0` (light lines on light card). Members bar border left as-is (`#c4b5fd`).
- [x] Preserved user changes: `#teamCards` `grid-cols-4` (teams.html) untouched.
- [x] Verify: `node --check teams.js` passes; 0 light text refs (`#e9d5ff`/`color: '#c4b5fd'`), 1 dark legend `#1e3a8a`, 3 dark ticks `#334155`.
## Task: /admin/reports/teams — Team Performance Details → Blue/Cyan theme (preserve user changes)

- [x] Changed the 4 stat boxes from violet to a Blue/Cyan theme: `const box = 'border-cyan-300 bg-cyan-50 text-cyan-900'`; Avg Score value `text-violet-950` → `text-cyan-950`; updated the descriptive comment.
- [x] PRESERVED user's changes: `#teamCards` container in teams.html stays `grid-grid-cols-1 md:grid-cols-4 gap-3` (4-column) and box labels stay Team Size / Avg Score / Total Reviews / Participation Rate.
- [x] Verify: `node --check teams.js` passes; 0 violet box refs, 1 cyan box ref, 0 text-violet-950, 1 text-cyan-950; teams.html untouched this round.
## Task: /admin/reports/teams — change Team Performance Comparison chart to violet theme

- [x] Restyled the "Team Performance Comparison" bar chart (`teams.js` `renderChart`) to a consistent violet theme matching the team detail boxes.
- [x] Average Score bar: fill `rgba(139,92,246,0.6)` / border `#8b5cf6`; Members bar (was green): fill `rgba(196,181,253,0.45)` / border `#c4b5fd`.
- [x] Axis tick text changed from sky `#7dd3fc` → violet `#c4b5fd` (all 3 axes); legend label `#c4b5fd` → brighter violet `#e9d5ff` for the dark container.
- [x] Verify: `node --check teams.js` passes; 0 remaining sky `#7dd3fc` / green `rgba(34,197,94` refs; frontend-only change (hard refresh to see).
## Task: /admin/reports/teams — restyle Team Performance Details boxes (color + text)

- [x] Per user choice: fixed violet theme for all 4 stat boxes per team card (replaced score-based emerald/blue/slate `accent` logic) + renamed labels.
- [x] Renamed: Members → Team Size, Scores → Total Reviews, Participation → Participation Rate; Avg Score kept (value text switched from blue-950 to violet-950 for consistency).
- [x] Applied via `teams.js` `renderTeamCards()`: `const box = 'border-violet-300 bg-violet-50 text-violet-900'` for all boxes.
- [x] Verify: `node --check teams.js` passes; 0 remaining `accent` refs, 4 `${box}` (violet) refs; frontend-only change (hard refresh to see).
## Task: Fix /admin/reports/audits page (broken table — HTML & JS only)

**Issue**: The page at `/admin/reports/audits` rendered nothing (Loading stuck, stats/charts/table empty).

- [x] Root cause (same as meetings page): `audits.html` "Audit Records" table used `<div id="auditBodyContainer">` in place of `<tbody>`, and the `<table>` was never closed. `audits.js` `loadAudits()` calls `document.getElementById('auditBody').innerHTML = ...` on its first line → `Cannot set properties of null`, aborting before stats/charts render.
- [x] Fix HTML: replaced `<div id="auditBodyContainer">` with `<tbody id="auditBody">` (with a loading row) and closed the `</table>` tag.
- [x] Verified API contract already correct (HTML/JS only scope): JS calls `/api/admin/audit-reports/summary?startDate&endDate&instructorIds` and `/instructors?calendarConnected=true`; `auditReportController` reads the same param names. All element IDs (`auditBody`, `totalAudits`, `passedCount`, `failedCount`, `passRate`, `passRateChart`, `categoriesChart`) match between HTML and JS.
- [x] Verify: `node --check` on audits.js passes; `auditBodyContainer` no longer present; `</table>` now closes properly.
## Task: Fix /admin/reports/meetings page (broken table + wrong column names)

**Issue**: The page at `/admin/reports/meetings` rendered nothing (loading spinner stuck, no stats/trend/list).

- [x] Root cause #1 (CRITICAL): `meetings.html` "All Meetings" table had `<div id="meetingsBodyContainer">` in place of the `<tbody>` and the `<table>` was never closed — so `meetings.js` `loadMeetings()` threw `Cannot set properties of null (getElementById('meetingsBody'))` on its first line, aborting the whole page before stats/trend rendered.
- [x] Fix HTML: replaced the stray `<div id="meetingsBodyContainer">` with `<tbody id="meetingsBody">` (plus a loading row) and properly closed `</table>`.
- [x] Root cause #2: meetings table has no `start_time`/`end_time` columns (it uses `scheduled_start_time`/`scheduled_end_time`/`actual_start_time`/`actual_end_time` — confirmed in migration `014_create_meetings_table.js`). `meetings.js` used `m.start_time`/`m.end_time` so dates showed N/A, avg duration stayed "-", and the trend grouped everything under "Unknown".
- [x] Fix JS (`public/js/admin/reports/meetings.js`): avg-duration calc + table/trend/CSV date fields now use `scheduled_start_time`/`scheduled_end_time` (fallback `actual_start_time`).
- [x] Fix Controller (`controllers/meetings/meetingReportController.js`): `getSummary` avg-duration now uses `scheduled_start_time`/`scheduled_end_time`.
- [x] Verify: `node --check` on meetings.js, controller, and model all pass; `meetingsBodyContainer` and `m.start_time`/`m.end_time` no longer present in the meetings report layer.
## Task: Fix /admin/insights/decisions — filters do not trigger API call

**Issue**: On `/admin/insights/decisions`, the API at `/api/admin/insights/decisions` is only called on page load (with default date settings). Changing filters or clicking "Get Data" does NOT trigger an API call.

- [x] Root cause: `decisions.html` has no standalone `getDataBtn` button (unlike engagement.html). `createDateFilter()` in `common-ui.js` looks for `#getDataBtn` to wire up the click handler — when it's missing, no click handler is attached. Also `autoLoad` defaults to `true` (date changes auto-fire, but inconsistently), and instructor filter has `onSelect` auto-load (unlike engagement.js).
- [x] Fix: 
  - Added standalone `getDataBtn` button to `decisions.html` (matching engagement.html pattern with flex layout).
  - Set `autoLoad: false` in `decisions.js` dateFilter config (matching engagement.js).
  - Removed `onSelect` from instructor filter in `decisions.js` (matching engagement.js — use Get Data button only).
- [x] Verify: node --check on JS; hard refresh (Ctrl+F5) to test.

## Task: Restructure /admin/insights/decisions page design

**Issue**: User reported the page was "totally unstructured".

- [x] Found CRITICAL bug: `decisions.html` had an **extra `</div>`** (30 open / 31 close) at the end of the filters block, prematurely closing the `flex-1` column wrapper → summary/stats/tables nested incorrectly (broken top-level layout).
- [x] Duplicate "Get Data" buttons: `createSelectFilter` (Decision Type) always rendered its own embedded "Get Data" button, plus the standalone `getDataBtn`. Removed duplication.
- [x] Fixed `createSelectFilter` in `common-ui.js`: added optional `showButton` flag (default `true`, backward-compatible with `actions.js`/`risks.js`) and guarded button event listeners when the button is hidden.
- [x] Rewrote `decisions.html` filters section with clean 2-space indentation, single page-level `getDataBtn` (matches engagement.html), removed extra `</div>` → divs balanced (30 open / 30 close).
- [x] Updated `decisions.js`: typeFilter uses `showButton: false` (single Get Data button handles all filters); kept `autoLoad: false` + no instructor `onSelect`.
- [x] Verify: node --check on common-ui.js + decisions.js passed; div counts balanced.

## Task: Fix /admin/evaluation/scores — "Duplicate column name 'reviewer_id'"

**Error**: `scores.js:157 Failed to load scores: Error: Duplicate column name 'reviewer_id'` hitting `/api/admin/scores/filtered`.

- [x] Root cause: `ScoresModel.getFilteredScores` did `SELECT ms.*, ... u.id as reviewer_id`. `ms.*` already includes `meeting_session_scores.reviewer_id`, so the explicit `u.id as reviewer_id` alias produced a duplicate column → MySQL error. Since the join is `ON u.id = ms.reviewer_id`, the alias was redundant.
- [x] Removed `u.id as reviewer_id` from `models/scores/ScoresModel.js` (`getFilteredScores`). `reviewer_id` still returned via `ms.*`.
- [x] Fixed same latent bug in `models/meetings/MeetingSessionScoresModel.js` (`getAllScoresWithDetails`) — it used `SELECT ms.*, ... u.id as reviewer_id FROM meeting_scores` and `meeting_scores` also has `reviewer_id`. Used by scores report endpoint.
- [x] Verified consumers (`evaluationReportController` uses `s.reviewer_id`, `performance.js` uses `score.reviewer_id`) still receive `reviewer_id` via `ms.*`.
- [x] Checked `EvaluationReportModel.getRecentScores` — no duplicate (only `reviewer_name` alias), safe.
- [x] Verify: node --check on both edited model files passed.

## Task: Fix /admin/insights/risks — stop auto-calling risks API on date change

**Issue**: On `/admin/insights/risks`, changing the date filter immediately calls `/api/admin/insights/risks`. Desired: the API should only be called on page load (with default dates) and when the "Get Data" button is clicked (with selected date/filter values).

- [x] Root cause: `risks.js` uses `createDateFilter` with default `autoLoad: true` → date changes auto-fire `onFilter` → `loadRisks()`. Also there is no standalone `getDataBtn`.
- [x] Fix: 
  - `risks.html`: converted grid filter row to `flex flex-wrap items-end gap-3` and added a standalone `getDataBtn` (matching decisions/engagement pages).
  - `risks.js`: set `autoLoad: false` on the date filter so date changes do NOT auto-load; single page-level "Get Data" button triggers the fetch.
  - `risks.js`: severity filter uses `showButton: false` (avoid duplicate "Get Data" from createSelectFilter's embedded button).
- [x] Verify: node --check risks.js (passed); div balance 23=23; getDataBtn count=1 in risks.html.

## Task: Fix "Meeting Trends" chart on /admin/insights/analytics

**Issue**: The "Meeting Trends" section is not showing proper data / design is broken. Data is confirmed correct (meeting count per month, e.g. 2026-07 → 103, 2026-08 → 78), so the problem is the rendering.

- [x] Root cause (analytics.js `renderMeetingTrends`):
  - Bars use `style="height:${h}%"` inside a `flex flex-col` column that has **no explicit height** → percentage heights resolve to auto/0, so bars collapse/do not render.
  - Month label `t.month.slice(0,7)` on a value already in `'YYYY-MM'` shows raw "2026-07" instead of a friendly label.
- [x] Fix (only `public/js/admin/insights/analytics.js`):
  - Rebuilt bar chart with a fixed-height container and **pixel-based** bar heights (deterministic, bars render from the bottom).
  - Added `formatMonth()` to show a friendly short month + year label (e.g. "Jul 2026") with truncation/tooltip for long labels.
  - No changes to other pages.
- [x] Verify: node --check analytics.js (passed); JSON shape [{month, meeting_count}] confirmed; shared components untouched.

## Task: Enable server-side pagination + true total count footer on /admin/evaluation/scores

**Issue**: The scores table only shows the current page's rows and never displays the true total count / page controls, even though the backend already returns `totalCount`, `totalPages`, `currentPage`. The `createTable` component was being used in a purely client-side way, so the footer and pagination computed totals only from the ~20 rows loaded on screen.

- [x] Root cause:
  - Backend `/api/admin/scores/filtered` already server-paginates (returns current page + totalCount/totalPages).
  - `scores.js` flattened only the current page's rows into `createTable`; `createTable`'s client-side logic then treated those ~20 rows as the whole dataset → no true total footer, no page controls when totalCount > perPage.
- [x] Fix `createTable` (common-ui.js, backward-compatible):
  - Added `pagination.totalCount` support (server-side totals). When provided, use it for the footer "Showing X to Y of Z entries" and for totalPages, and do NOT double-slice client-side. When absent (existing pages), behavior is unchanged.
  - Added `setPaginationTotal()` and made `setPaginationPage(page, totalCount)` accept an optional total for updating across loads.
- [x] Fix `scores.js`:
  - Keep a reference to the pagination config and pass `totalCount` from the API response.
  - On each load, call `setPaginationTotal(totalCount)` + `setPaginationPage(page)` so page controls + footer stay in sync and `onPageChange` → `loadData(page)`.
- [x] Verify: node --check common-ui.js + scores.js (passed). Live model: totalCount=90, 20 rows/page → 5 pages — footer will show "Showing 1 to 20 of 90 entries" + page controls.

## Task: Enable pagination + total-count footer (createTable) on 4 report/insights pages

**Goal**: Use the full centralized `createTable` feature (entries-per-page, search, pagination footer "Showing X to Y of Z entries" + page controls) on the main data table of these pages without touching anything else:
- /admin/insights/risks (Recent Risks table)
- /admin/reports/meetings (All Meetings table)
- /admin/reports/evaluations (Evaluation Records table)
- /admin/reports/audits (Audit Records table)

- [ ] risks.html/js: convert #recentRisksTable to createTable container
- [ ] meetings.html/js: convert #meetingsBody to createTable container
- [ ] evaluations.html/js: convert #evaluationBody to createTable container
- [ ] audits.html/js: convert #auditBody to createTable container
- [ ] Verify: node --check all 4 JS + 4 HTML containers present; hard refresh to test.

## Task: Improve Providers grid color theme on /admin/settings/integrations

- [+] ISSUE: provider cards all plain white with light slate text → not color-themed / low visual hierarchy.
- [+] FIX: integrations.js renderProviderCards → per-provider color theme (Zoom=cyan, Google Meet=emerald, Teams=indigo): gradient card backgrounds, vivid borders, dark bold headings, white-on-badge status, bold count chips + uppercase bold labels, bold config rows.
- [ ] Verify: node --check integrations.js; themes + bold classes present.

## Task: Debug: /admin/evaluation/scores — data from API not visible on page

### Root Cause (PRIMARY BUG)
- **File**: `public/js/common-ui.js` → `createTable()` function
- **Issue**: `createTable()` never called `render()` on initial creation. When `scores.js` called `createTable({ ... data: flatScores ... })`, the data was stored in `currentData` but never rendered to the DOM. The `#scoresRoot` container retained the loading placeholder HTML indefinitely.
- **Fix**: Added `render();` call before `return` in `createTable()` — now the table with provided data is displayed immediately on creation.
- **Scope**: This fix benefits ALL pages using `createTable()`: scores, recordings, summaries, transcripts, videos, calendar, users, integrations.

### Secondary Bug
- **File**: `models/scores/ScoresModel.js` → `getFilteredScores()`
- **Issue**: Count query used `sql.replace()` with a string literal that didn't match the template literal's whitespace/newlines, so the replacement silently failed. This caused `totalCount` to be always `undefined`, resulting in the message showing "undefined score(s) found".
- **Fix**: Replaced fragile `sql.replace()` with a subquery: `SELECT COUNT(*) as total FROM (${sql}) as count_query`.
- **Note**: Requires server restart (`node server.js`) to take effect since Node.js caches `require()`d modules.

### Verification
- [x] `node --check` passes on all changed files
- [x] `require('./models/scores/ScoresModel.js')` loads without error
- [x] API returns `SUCCESS: true, CATEGORIES: 1, TOTAL COUNT: undefined` (totalCount bug confirmed; will be fixed on server restart)
- [x] `createTable` now calls `render()` on init — table will display immediately

## Task: Improve Account Details line-by-line separation on /admin/profile

- [x] ISSUE: populateAccountInfo rendered rows on the violet card with only a very light `border-slate-100` divider → hard to read line by line.
- [x] FIX: profile.js populateAccountInfo → render rows inside a white `divide-y divide-violet-200` card with uppercase label on left + value right, clear padding per row.
- [x] Verify: node --check profile.js passes; structure present. Frontend-only → hard refresh (Ctrl+F5).

## Task: Make notifications toggle show active/inactive colors reliably

- [x] ISSUE: toggle used Tailwind `peer-checked:` variant on HTML injected after load → color not switching on toggle.
- [x] FIX: notifications.js renderNotifBody → span-based track+thumb; bind checkbox change in JS to switch track bg (emerald ON / slate-400 OFF) + slide thumb (translateX). Keeps checkbox id for collectSettings.
- [x] Verify: node --check passes; structure has js-notif-toggle / js-toggle-track / js-toggle-thumb; initial state reflects `on`. Frontend-only → hard refresh (Ctrl+F5).

## Task: Fix 404 on /admin/settings/integrations (wrong API base path)

- [x] ROOT CAUSE: route is mounted at `/api/calendar-integrations` (registry.js + routes/index.js), but integrations.js calls `/api/admin/calendar-integrations/...` → never mounted → 404.
- [x] FIX: integrations.js — change all 3 API URLs (integration-status, connections, disconnect) to `/api/calendar-integrations/...`.
- [x] NOTE: frontend-only change → no server restart; hard refresh (Ctrl+F5) to view.
- [x] Verify: node --check integrations.js passes; 0 remaining `/api/admin/calendar-integrations` calls.

## Task: Align /admin/profile with admin DASHBOARD theme & structure

- [x] REASON: profile.html used old-style white cards (border-slate-300, text-sm, icon chips) not matching the gradient color-coded "DASHBOARD" theme used across admin settings/insights/reports pages.
- [x] HTML: rebuild profile.html → light theme, gradient section cards (Profile=blue/cyan, Password=amber/orange, Account=violet/purple), colored uppercase tracking-wide headers, consistent compact inputs/buttons; add identity banner (userAvatar/userName/userRole) in Account card.
- [x] Keep all IDs used by profile.js: profileForm, firstName, lastName, email, phone, cancelBtn, passwordForm, currentPassword, newPassword, confirmPassword, accountInfo (plus userAvatar/userName/userRole).
- [x] Scripts: tailwind CDN + ../css/shared.css + ../js/common-ui.js (in head) + auth.js + load-components.js + profile.js.
- [x] Verify: tags balanced (div/form/button/label/main closed; inputs self-closing), all IDs present, node --check profile.js passes.

## Task: Make Company Profile view-only in Settings > Organization

- [x] FIX (HTML): organization.html → all Company Profile fields rendered read-only (companyName, companyCode, domain, logoUrl, status); remove "Save Settings" button + saveMsg.
- [x] FIX (JS): organization.js → remove bindSave() call and saveOrganization()/bindSave() so nothing attempts to edit the profile.
- [x] FIX (backend): organizationController.update → reject profile edits (read-only), return 403 so API cannot change profile either.
- [x] NOTE: Departments table + stats already view-only; only Company Profile changes.
- [x] Verify: node --check on JS/controller; update() returns 403; GET still returns profile for viewing.
- [ ] Requires server restart (backend change) + hard refresh (Ctrl+F5) to view.

## Task: Fix invisible toggle/switch in Settings > Notifications page

- [x] BUG: toggle uses `h-4.5` (invalid Tailwind class → no track height) and white thumb on light `bg-slate-300` track → OFF switch collapses/invisible on light background.
- [x] FIX: notifications.js renderNotifBody → valid dimensions (w-9 h-5, thumb h-4 w-4), `relative` on track so `after:` thumb positions correctly, darker off-state track (slate-400) + emerald on; white thumb for clear contrast.
- [x] Verify via node --check (passes). Frontend-only change → no server restart needed; hard-refresh (Ctrl+F5) to view.

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

## Task: Design merged calendar_connections table (calendar_integrations + calendar_verifications)

- [x] Drop calendar_integrations + calendar_verifications after backfill (data temporary, no safety net)
## Task: Apply calendar_connections renames across models/controllers/services

## Task: Run migration 058 + verify status mapping

- [x] Ran migration 058 up(): calendar_connections created, calendar_integrations + calendar_verifications dropped
## Task: Run full DB reset (npm run db:reset)

- [x] Explained migration 058 phases: CREATE (new table) -> INSERT (backfill) -> DROP (old tables)
- [x] Ran node database/reset-db.js --force: all tables dropped, recreated, seeded
- [x] Verified final state: calendar_connections present, calendar_integrations + calendar_verifications not-created, calendar_providers present
- [x] Verified backfill: 9 rows preserved; rows with matching (user_id, provider_id) merged; provider-3 (teams) vs google-meet(2) rows kept separate (correct per key)
- [x] Verified connection status mapping: instructor frontend reads conn.status (instructor branch maps connection_status); admin calendar page reads Calendarstatus (maps connection_status) - both show 'active'
- [x] Verified verification status (pending/verified/expired/connected) is internal to CalendarVerificationModel (verification_status); not exposed to any generic frontend status field
- [x] Removed temp test scripts
- [x] CalendarUsersModel -> calendar_connections; connection_status, token_expires_at, provider_id; provider name via join to calendar_providers
- [x] CalendarVerificationModel -> calendar_connections; verification_status, verification_token, verification_expires_at; resolveProviderId helper
- [x] CalendarAuthModel getUserTokens -> token_expires_at
- [x] calendarSyncService token check -> token_expires_at
- [x] MeetingModel getUserStats (x2) -> calendar_connections + provider join; aliased output keeps API contract (status/token_expiry)
- [x] SessionQualityFilterModel -> calendar_connections
- [x] meetingScheduleController, calendarController, instructorCalendarController, recordingsController, MeetingRecordingsModel -> connection_status / token_expires_at
- [x] Removed all calendar_integrations / calendar_verifications table references (backend); updated comments/logs
- [x] Syntax check (14 files) + load tests for models/controllers + migration; all pass
- [x] Removed calendar_credentials entirely (migration 021, model, seeder, controller/frontend dependency); kept google_oauth_credentials (still used by GoogleOAuthCredentialsModel)
- [x] Removed platform/provider from merged table; provider_id is identity; resolves provider_id for verifications via calendar_providers


## Task: Remove calendar_credentials entirely

## Task: Run DB reset + manual seed (with updated calendar seeders)

## Task: Fix verification_status showing 'expired' (locale date-parsing bug)

- [x] Root cause: verifyToken + sync token check built "now" via toLocaleString('en-IN') (DD/MM/YYYY) but Date() parses as US MM/DD/YYYY, swapping day/month -> expiry always compared as past -> 'expired'
- [x] Fixed CalendarVerificationModel.verifyToken to compare timestamps (new Date(expires).getTime() < Date.now())
## Task: Never leave verification_status as 'expired' (use Google access TTL + refresh)

- [x] Changed verification expiry from 30 min to 1 hour (Google access token TTL = 3600s) in create() and updateTokenByUserId()
- [x] verifyToken no longer writes 'expired' - re-verifies via refresh token (sync auto-refreshes access token) so status stays 'verified'
- [x] Confirmed no remaining calendar 'expired' writes; syntax + load pass
- [x] Fixed calendarSyncService.js token-refresh check to the same reliable comparison
## Task: Always keep calendar sync active via refresh token (polling/auto-run)

- [x] CalendarUsersModel.getConnectedUsers() only returns users whose row has ALL: access_token, refresh_token, token_expires_at, connection_status='active', verification_token, verification_status='verified' (deduped by user)
- [x] Verified via live DB demo: 0 before -> 1 when a row is fully qualified -> 0 after revert
- [x] getConnectedUsers() includes verification_status IN ('verified','expired') - expired users with a refresh token are still synced
- [x] Added CalendarUsersModel.markVerifiedByEmail(email) - flips 'expired' -> 'verified'
## Task: Fix FK error on token refresh (email passed as user_id)

## Task: Store timezone / scheduled_start_time / scheduled_end_time / description in sync

- [x] Root causes: storeMeetingFromEvent passed startTime/endTime (getMeetingByIdOrCreate reads scheduled_*); used e.start.timezone (Google returns timeZone); never passed description
- [x] storeMeetingFromEvent now passes scheduled_start_time/end_time, e.start.timeZone, and description (default 'no description')
- [x] getMeetingByIdOrCreate (models/meetings) added description to INSERT + UPDATE and fixed param/column alignment
- [x] Verified live: start/end stored (UTC), timezone stored, description stored, and 'no description' default works
## Task: Fix auto-sync stopping after first run (only worked on restart)

## Task: Fix polling launch error (meeting_id missing)

## Task: Engagement page should load data on date filter change

## Task: Actions page showing no data - create manual seeder for teacher action tables

- [x] Traced data source: /api/admin/insights/actions -> actionsController -> ActionsModel reads teacher_coaching_feedback (recommended_action) + teacher_better_alternatives (better_alternative), joined to meetings + users
- [x] Root cause: both tables had 0 rows (existing seeders seed session_* tables, not teacher_*)
- [x] Created manual-seeder/23_seed_teacher_actions.js (seeds meetings that join to admin-company users)
- [x] Ran seeder: created 20 teacher_coaching_feedback + 20 teacher_better_alternatives
- [x] Verified ActionsModel.getCoachingActionItems/getBetterAlternatives now return 20 rows each for admin
- [x] Root cause: createDateFilter only fired onFilter on Get Data button click; date change only validated
- [x] common-ui.js createDateFilter now auto-fires onFilter when From/To dates change (centralized - benefits all filter pages)
- [x] engagement.js removed redundant page-specific date listeners (uses centralized onFilter now)
- [x] Verified both files pass node --check
- [x] Root cause: BotManager.launchFromDb read meetingRecord.meeting_id (undefined) but getQueuedMeetings returns external_meeting_id -> createSession(undefined) threw
- [x] Fixed line 113 to use meetingRecord.external_meeting_id
- [x] Verified syntax + load; launchFromDb working
- [x] Root cause: scheduleBackgroundSync did `await globalSync()` then schedule setTimeout; if globalSync threw, setTimeout never ran -> periodic loop died
- [x] Wrapped in try/catch/finally so the loop always re-schedules (auto-sync stays alive)
- [x] Fixed misleading startup log (Auto-Sync 1min -> 30min, matching actual interval)
- [x] Syntax check passes
- [x] Root cause: CalendarAuthModel.saveUserTokens used the passed value as calendar_connections.user_id (FK to users.id); both callers passed an email
- [x] Fixed saveUserTokens to accept email OR id - resolves email -> user id via UsersModel.getUserByEmail
- [x] Verified test.justtutors@gmail.com -> user_id 20; syntax + load pass
- [x] CalendarEventController.ensureValidToken calls markVerifiedByEmail after a successful refresh
- [x] Verified live demo: expired user included in sync candidates; after refresh verification_status -> 'verified'
- [x] CalendarSyncController.globalSync() now targets connected users (have refresh token) instead of all users
- [x] Background sync refreshes expired access token via refresh_token (CalendarEventController.ensureValidToken) then syncs meetings
- [x] server.js no longer gates background sync behind RUN_CAL_SYNC_AT_START - scheduleBackgroundSync() always runs (every 30 min)
- [x] Verified getConnectedUsers returns the connected users; syntax + load pass
- [x] Confirmed remaining sv-SE usages are store/format only (safe); syntax + load pass
- [x] Updated 03_seed_calendar_verifications.js + 04_seed_calendar_integrations.js to seed merged calendar_connections (provider_id, connection_status, verification_*)
- [x] Ran node database/reset-db.js --force (all tables dropped, recreated, seeded)
- [x] Ran node database/run-manual-seeders.js -> 21 succeeded, 0 failed
- [x] Verified calendar_connections populated (verification rows @ provider_id 2 + integration rows @ random providers)

- [x] Deleted migration 021_create_calendar_credentials_table.js
- [x] Deleted models/calendar/CalendarCredentialsModel.js
- [x] Deleted manual-seeder 05_seed_calendar_credentials.js
- [x] Removed CalendarCredentialsModel dependency from calendarIntegrationController.js (has_credentials: true since creds are .env-based)
- [x] Removed DELETE FROM calendar_credentials from CalendarProvidersModel.deleteById
- [x] Updated comments in routes/calendar-integrations.js, routes/index.js, public/js/admin/settings/integrations.js
- [x] Dropped calendar_credentials table from DB
- [x] Verified no code references remain; controller/route/models load OK; syntax checks pass

- [x] Inventory all call sites of calendar_integrations / calendar_verifications / token_expiry (models, controllers, services, seeders)
- [x] Decide status collision -> split into connection_status + verification_status (recommended)
- [x] Decide expires_at collision -> token_expires_at + verification_expires_at; flag token_expiry as redundant duplicate of expires_at
- [x] Create migration 058_create_calendar_connections_table.js (CREATE TABLE + 2-pass backfill; old tables kept as safety net)
- [x] Provide proposed (not applied) query updates per call site + rollback plan


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

## Task: Apply DASHBOARD IMPROVEMENT PROMPT TEMPLATE to /admin/insights/risks page
- [x] Apply gradient color scheme to filter bar + summary KPI cards (light theme)
- [x] Convert Risk Type Distribution / Instructor Risk Breakdown / Recent Risks to scrollable tables (max-h-64/80, sticky headers, custom-scrollbar)
- [x] Update risks.js render functions to emit light-themed table rows (readable on light cards)
## Task: Move SQL out of insights controllers into models (rules compliance)
- [x] risksController.js - remove dead embedded SQL; route calls RisksModel.getQualityFlagRisks/getQualityScoreRisks
- [x] decisionsController.js - remove dead SQL (sql + coachingSql); calls DecisionsModel.getEvaluationDecisions/getCoachingDecisions
- [x] engagementController.js - remove dead SQL; calls EngagementModel.getEngagementReports; drop unused imports
- [x] actionsController.js - remove dead SQL (sql + altSql); calls ActionsModel.getCoachingActionItems/getBetterAlternatives
- [x] Verified all 4 controllers + 4 models node --check, load at require-time, no SQL/db remains in controllers
## Task: Align /admin/insights/decisions page with engagement/risks template
- [x] Convert dark card-lists to light-themed scrollable tables (instructor + recent) so JS text is readable
- [x] Light-theme filter bar + -200 borders + text-[13px] headers for cross-page consistency
- [x] Verify decisions.html tags balanced, all IDs match decisions.js, node --check on decisions.js
## Task: Add instructor filter to /admin/insights/engagement page (full MVC stack)
- [x] HTML: Add Instructor dropdown container (#instructorFilterContainer) to filter bar (between To Date and Get Data)
- [x] JS: Add loadInstructors() using createSearchableSelect (centralized from common-ui.js), include instructor_id in POST body, auto-reload on select
- [x] Route: Add GET /instructors to routes/insights.js (engagementController.getInstructors)
- [x] Controller: Add getInstructors method that calls EngagementModel.getInstructors
- [x] Model: Add getInstructors (SQL joins users -> meetings -> session_quality_reports, company_id filter for admin)
- [x] DB: Existing tables (users, meetings, session_quality_reports) — no migration needed
- [x] Verified: node --check all layers, routes load, model query returns instructors
## Task: Add instructor filter to /admin/insights/decisions page (full MVC stack)
- [x] HTML: Add Instructor dropdown (#instructorFilterContainer) to decisions filter bar; grid 4-col to 5-col
- [x] JS: Add instructorFilter var + loadInstructors() (createSearchableSelect), send instructor_id in POST body, auto-reload on select
- [x] Route: Reuse shared GET /api/admin/insights/instructors (already wired in routes/insights.js)
- [x] Controller: Reuse shared engagementController.getInstructors (already wired)
- [x] Model: Extend EngagementModel.getInstructors to cover ALL 4 insights data sources (session_quality_reports, session_final_evaluation, teacher_coaching_feedback, teacher_better_alternatives, session_quality_flags)
- [x] DB: Verified extended query returns instructors (count 1 -> 3 with decisions/actions/risks sources)
- [x] Fix: engagement.html was missing jQuery + Select2 CDN (createSearchableSelect requires both) - added so engagement instructor dropdown renders
- [x] Verified: node --check all layers, routes load, HTML structure + tables balanced, decisions.js flow complete
## Task: Build missing Analytics page MVC stack (HTML > JS > Routes > Controller > Model > DB)
- [x] Verified engagement/decisions/actions/risks all follow MVC flow (all 4 return DB data)
- [x] Identified analytics page as static placeholder - no API, no MSS, no DB data
- [x] Model: Created AnalyticsModel.js (getMeetingTrends/getScoreDistribution/getOverallMetrics)
- [x] Controller: Created analyticsController.js (getAnalytics calls model, no SQL)
- [x] Route: Added POST /analytics to routes/insights.js
- [x] JS: Created analytics.js (fetch + render meeting trends/score distribution/overall metrics)
- [x] HTML: Rebuilt analytics.html (light template, section ids, dynamic containers, script tag)
- [x] DB: Verified ANALYTICS API returns real data (trends 2, scoreBands 2, totalSessions 10)
## Task: Add date filter + instructor filter to /admin/reports/meetings page (full MVC stack)
- [x] Model: Replaced getRecentMeetings(days) with getMeetings({from_date, to_date, instructor_id}) + getInstructors(user) (active + calendar-connected)
- [x] Controller: Updated getSummary to accept query params (from_date, to_date, instructor_id); added getInstructors
- [x] Route: Added GET /api/meetings/reports/instructors
- [x] HTML: Added filter bar (From/To date, Instructor dropdown, Get Data, Export CSV); jQuery+Select2; section IDs; scrollable table (max-h-[28rem] custom-scrollbar)
- [x] JS: Rewritten with dateFilter (default 30 days, autoLoad false) + instructorFilter (createSearchableSelect); calls registered /api/meetings/reports/summary
- [x] Verified: getMeetings=100 rows, getInstructors=5 rows, route loads, controller + syntax OK, HTML elements present
## Task: Add date filter + Get Data + Active + Instructor filters to /admin/reports/evaluations

- [x] Model: extend EvaluationReportModel (getRecentScores/getRecentMeetings accept from_date/to_date/instructor_id/active; add getInstructors)
- [x] Controller: read new query params, pass filters to model; add getInstructors action
- [x] Route: add GET /instructors to routes/evaluation-reports.js
- [x] HTML: light template, filter bar (date+Get Data+Active+Instructor+scoreType+Export), compact stats, scrollable Evaluation section (7 headers), score-trend table (chart -> table), remove chart.js
- [x] JS: createDateFilter(30d default, Get Data), instructor select w/ auto-reload, active checkbox, remove chart, render scrollable light tables
- [x] Verify: node --check all layers (model/controller/route/JS) + require-load test pass; restart server by user for API 200 confirm
## Task: Add MVC backend + date/instructor filters to /admin/reports/teams
- [x] Model: create TeamReportModel (getTeams, getScores, getTeamPerformance, getInstructors - active + calendar-connected)
- [x] Controller: create teamReportController (getSummary/getInstructors - no SQL)
- [x] Route: create team-reports.js (GET /summary, GET /instructors) + register at /api/admin/reports/teams in registry.js
- [x] JS: refactor teams.js to call /api/admin/reports/teams/summary with from_date/to_date/instructor_id; keep bar chart, 1-month default + Get Data, instructor Select2 filter (added jQuery/Select2 CDNs)
- [x] Verify: node --check all layers + require-load + registry mount; server restart by user for API 200 confirm
## Task: Fix /admin/reports/audits API wiring (align frontend to registered backend route)
- [x] Verified page already provides the requested features: Pass/Fail Distribution + Audits by Category column/bar charts (type bar, indexAxis x), Start/End date filter (1-month default) + Get Data, auto-load on refresh, active + calendar-connected instructor filters (non-dependent), and full MVC backend (auditReportController + AuditReportModel + audit-reports route mounted at /api/admin/audit-reports)
- [x] Fixed URL mismatch: audits.js called /api/audit-reports/* but the registry mounts handler 'audit-reports' at /api/admin/audit-reports -> updated 3 calls (2x /instructors, 1x /summary) to /api/admin/audit-reports/*
- [x] Verified: node --check JS + zero stale /api/audit-reports refs; server restart by user for API 200 confirm
## Task: Fix /admin/reports/evaluations - instructors API empty + Active filter inactive
- [x] Root cause: meeting_scores.meeting_id maps to meetings.id (internal PK), not meetings.external_meeting_id (string like meeting_*). Fixed joins in EvaluationReportModel.getRecentScores (LEFT JOIN meetings m ON m.id = ms.meeting_id) and getInstructors EXISTS subquery (ms.meeting_id = m.id)
- [x] getInstructors verified now returns 1 instructor (John Instructor, id 3) for admin company 1; getRecentScores now returns all 10 scores with meeting_title
- [x] Active filter: meetings all have status 'sync' so the old IN ('active','joining') matched 0 -> changed to NOT IN ('completed','cancelled'); verified active query returns data
- [x] JS: fixed meeting-key mapping from external_meeting_id to meetings.id (3 places), rubric count uses indicator_id, and Active checkbox now triggers loadScores() on change
- [x] Verify: node --check model + JS; model test confirms instructors + scores + active
## Task: Build /admin/settings/organization page with dynamic DB data (full MVC)
- [x] DB: reuse companies, users, roles, departments, department_members, meetings, meeting_scores (no new tables)
- [x] Model: create models/settings/OrganizationModel.js (getProfile from companies, getStats counts, getDepartments w/ member_count, updateProfile whitelist)
- [x] Controller: create controllers/settings/organizationController.js (get = profile+stats+departments; update = PUT profile) - no SQL
- [x] Route: add GET/PUT /api/admin/settings/organization in routes/settings.js
- [x] JS: rewrite public/js/admin/settings/organization.js to load/save via the endpoint + render stats + departments
- [x] HTML: rewrite public/admin/settings/organization.html (light theme, stats cards, editable company profile, departments table) + load common-ui.js (was missing so apiFetch/showToast were undefined)
- [x] Verify: node --check model/controller/route/JS; live model test admin company 1 -> profile Default Organization, stats {users 18, instructors 11, departments 5, meetings 181, scores 10}, 5 departments; HTML IDs present
## Task: Re-verify /admin/reports/evaluations (instructors + active filter) after re-report
- [x] Confirmed prior fixes already in code: getRecentScores join ON m.id = ms.meeting_id; getInstructors EXISTS ms.meeting_id = m.id; active filter m.status NOT IN ('completed','cancelled'); JS sends active=1 + reloads on toggle
- [x] Broadened EvaluationReportModel.getInstructors to return ALL active + calendar-connected instructors (roles/jobs/calendar_connections) instead of only those with scored meetings -> now returns 5 instructors for company 1 (was 1)
- [x] Verified: node --check model + JS; live getInstructors = 5; JS active param + change listener present
- [x] NOTE: running server must be restarted to pick up model changes
## Task: Build /admin/settings/notifications page with dynamic DB data (full MVC)
- [x] DB: reuse system_settings (company-scoped key/value) to store notif.<channel>.<role> keys; roles from roles/users
- [x] Model: create models/settings/NotificationSettingsModel.js (getSettings defaults all-on, getRoleCounts admin/instructor/reviewer, updateSettings upsert per channel+role)
- [x] Controller: create controllers/settings/notificationSettingsController.js (get = settings+roleCounts; update = PUT settings) - no SQL
- [x] Route: add GET/PUT /api/admin/settings/notifications in routes/settings.js
- [x] JS: rewrite public/js/admin/settings/notifications.js to load/save role x channel matrix + role reach stats
- [x] HTML: rewrite public/admin/settings/notifications.html (light theme, 3 role stat cards, role x channel toggle table, save) + load common-ui.js (was missing)
- [x] Verify: node --check all layers; live getSettings (defaults true), roleCounts {admin 1, instructor 11, reviewer 6}; update persists + reset; HTML IDs present
## Task: Audits - replace two multi-select instructor filters with single centralized createSearchableSelect
- [x] testimonials.html: remove 'Active Instructors' + 'Calendar Connected Instructors' blocks, add single #instructorFilterContainer
- [x] testimonials.js: loadInstructors uses centralized createSearchableSelect (single) with /api/admin/audit-reports/instructors?calendarConnected=true; loadAudits reads single instructorId -> instructorIds param
- [x] Cleaned stale refs: createDarkSearchableSelect=0, activeInstructorFilter=0, calendarInstructorFilter=0, multiSelect=0; SYNTAX=0
- [x] Data source verified: AuditReportModel.getActiveInstructors(1, true) -> 5 instructors
## Task: Audits page - scrollable table + heading, and dark graph text
- [x] HTML: audit table card got 'Audit Records' heading + vertical scroll (overflow-y-auto max-h-96 custom-scrollbar); both chart cards converted from dark bg-slate-900 to light (from-blue-50 to-cyan-100) with clearer headings
- [x] JS: chart text now dark - legend #0f172a, ticks #334155, light grid #e2e8f0 (readable on light cards)
- [x] Verify: node --check (SYNTAX=0); HTML - 2 light chart cards, Audit Records heading, scrollable table, auditTypeFilter + stats intact
- [x] Note: frontend-only change; no controller/model needed; hard refresh to view
## Task: Teams - teamCards separation, bold text, full cover + title (no white text)
- [x] HTML: wrapped teamCards in a full-cover panel (violet gradient border) with main title 'Team Performance Details'
- [x] JS renderTeamCards: each metric (Members/Avg Score/Scores/Participation) in its own bordered+colored box (visible separation); labels font-bold, values font-extrabold
- [x] No white text (dark/colored text throughout)
- [x] Verify: node --check (SYNTAX=0); 4 metric boxes, ${accent} refs=4, font-extrabold=4, text-white=0; cover panel + title present
## Task: Audits - Audit Records header text black + bold (lighten table for visibility)
- [x] HTML: 'Audit Records' heading changed from text-white font-semibold -> text-black font-bold
- [x] HTML: lightened the audit table card (dark bg-slate-900 -> blue gradient), header row blue-200, 8 headers text-blue-950, tbody divide-blue-200
- [x] JS renderTable: row text/colors changed to dark for light bg (type/status/score colors to violet-700/blue-700/red-700, cells slate-700/600, hover blue)
- [x] Verify: node --check (SYNTAX=0); black bold heading present; no stale light text refs
## Task: Build /admin/settings/meetings page with dynamic DB data (full MVC)
- [x] DB: reuse system_settings (meeting.* keys), meetings, meeting_sessions, meeting_scores, users/roles
- [x] Model: create models/settings/MeetingSettingsModel.js (getSettings defaults, getStats counts, updateSettings upsert; fixed WHERE-before-JOIN bug)
- [x] Controller: create controllers/settings/meetingSettingsController.js (get = settings+stats; update) - no SQL
- [x] Route: add GET/PUT /api/admin/settings/meetings in routes/settings.js
- [x] JS: rewrite public/js/admin/settings/meetings.js (load/save settings + render stats)
- [x] HTML: rewrite public/admin/settings/meetings.html (7 stat cards + meeting rules form: auto-record, retention, duration, platform, transcript, notify instructor, auto-assign reviewer, reminders) + load common-ui.js
- [x] Verify: node --check all; live getSettings defaults, getStats {181/0/181 meetings, 154 sessions, 10 reviews, 11 instructors, 6 reviewers}, update ok; HTML ids present
## Task: Enhance /admin/settings/integrations page with dynamic DB data (full MVC)
- [x] Already: basic provider status API (`GET /api/admin/calendar-integrations/integration-status`)
- [+] NEW: Model method `getProviderConnectionStats(providerId)` → per-provider connected/active/verified counts
- [+] NEW: Model method `getConnectedUsersByProvider(providerId, adminId)` → user rows with name/email/connection+verification status per provider
- [+] NEW: Controller `getIntegrationDetails` returning provider stats + connected users
- [+] NEW: Route `GET /api/admin/calendar-integrations/details` (auth + role admin)
- [+] NEW: JS `public/js/admin/settings/integrations.js` → render provider cards + stats + connected users table + per-provider config details
- [+] NEW: HTML `public/admin/settings/integrations.html` → 3 provider stat cards, connected accounts per provider toggle, provider config panel
- [x] Verify: existing route registration + model + controller all follow MVC flow and existing code conventions
## Integrations Page — Dynamic Data (COMPLETED)
- [x] Model (CalendarUsersModel): getProviderStats / getConnectedAccounts / disconnectConnection
- [x] Controller (calendarIntegrationController): getIntegrationStatus parses config_json + attaches per-provider counts; added getConnectedAccounts + disconnectConnection
- [x] Routes (calendar-integrations): GET /integration-status (enriched), GET /connections, POST /disconnect
- [x] HTML: converted to light DASHBOARD template (stat cards + provider cards + connected-accounts panel)
- [x] JS: renders dynamic stats + clickable provider cards + createTable accounts table + disconnect action (uses common-ui apiFetch/showToast/escHtml/createTable)
- [x] Verified live DB: Zoom 2 active/0 verified, Google Meet 5/5, Teams 2/0; accounts join name/email/role/status
- [x] node --check passes on all changed JS; controller + route require-load pass
- [ ] Requires server restart (production node server.js) + hard refresh (Ctrl+F5) to see live
