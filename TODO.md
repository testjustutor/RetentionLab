## Add step-by-step flow logging for GET /api/super_admin/sidebar-menu-management/permissions?role_id= (2026-09-17)

**Request:** log the entire request flow of side-menu perms GET ... -- every function call, inside functions, and DB query start/stop -- using existing utils/logger.js (writes to logs/info-*.log).

- [x] TODO entry created
- [x] Query layer: logs in database/seedHelpers.js (allAsync/getAsync/runAsync start+stop+duration+rows)
- [x] Route layer: API-hit + finish log on sidebar-menu-management mount in routes/super_admin/index.js
- [x] Route layer: dispatch log for GET /permissions in routes/super_admin/sidebar-menu-management.js (+ fixed the pre-existing missing `handle()` wiring that left this endpoint hanging without a response — confirmed via live test; previously computed results were never sent)
- [x] Controller layer: getMenuPermissions() entry/branches/model-call/result logs
- [x] Model layer: getRoleMenuTree(), getMenuItemsWithPermissions(), _nestByParentId() logs
- [x] node --check on all edited files
- [x] Live API hit verification (200 OK + full flow trail in logs/info-2026-09-17.log starting `[Route:SuperAdmin] API hit` and ending `[Route:SuperAdmin] API finished ... -> status 200`)
# TODO

## Fix AI-audit final score weighting (2026-09-16)

**Problem:** `review_calculation_logic.txt` documented that the tutor-evaluation
final score is a weighted average of category scores by **criteria count**,
never by the rubric's configured category **weight** (`cat_score`). The
manual reviewer scoring path (`controllers/reviewer/tutorEvaluationController.js`)
was already fixed to weight by configured category weight. The AI auto-audit
pipeline (`services/engine/audit_service.py`, `services/engine/audit_storage.py`)
was still using the old criteria-count formula (`compute_overall_from_category_rows`)
even though it already fetches each category's configured weight — so the
AI's `final_score` (shown to super admins via
`controllers/super_admin/reports/MeetingAiEvaluationReportController.js`,
sourced from `ai_audit_overall_summary`) disagreed with what a human reviewer
scoring the same session would get, whenever a rubric has unequal category
weights.

- [x] Trace the discrepancy from `review_calculation_logic.txt` through
      the actual code (`audit_scoring.py`, `audit_service.py`,
      `audit_storage.py`) to confirm it's live, not just documentation.
- [x] Confirm `compute_category_score_from_counts(..., calc_source="submit")`
      (per-category score) already matches the canonical formula — only the
      **overall/final** score aggregation was wrong.
- [x] Confirm the `calc_source="update"` swap-bug branch is never actually
      invoked anywhere in the current codebase (no caller passes
      `calc_source="update"`) — it's unused/reserved for a future
      reviewer-override flow, not a currently-live bug.
- [x] Update `services/engine/audit_service.py` (`_score_categories`) to
      build `category_rows` as `(category_score, category_weight)` pairs
      (weight falls back to 1 when unconfigured) and call
      `compute_weighted_overall()` instead of
      `compute_overall_from_category_rows()`.
- [x] Update `services/engine/audit_storage.py` (`store_audit_results`) the
      same way for the persisted `ai_audit_overall_summary.final_score`.
      Kept `total_weighted_percent` / `total_criteria_all` columns computed
      from criteria count (unchanged, informational only) so existing
      readers of those two columns aren't affected.
- [x] Syntax-check both files (`python3 -c "import ast; ast.parse(...)"`).
- [x] Sanity-test the math change with a standalone script confirming the
      new formula respects configured weight (3:1 weighted example: old
      formula gave 50%, new formula gives 75% as expected).
- [ ] Decided with the project owner: **fix forward only** — existing rows
      in `ai_audit_overall_summary` / `ai_audit_category_scores` are left
      as-is; only newly-run AI audits get the corrected weighting. No
      backfill script was requested or written.
- [ ] Recommended follow-up (not done, needs a decision): the same
      criteria-count-vs-weight inconsistency may be worth double-checking
      in any other place that reads `category_rows`-shaped data before
      considering this fully closed project-wide.

## Dead-code cleanup pass 2 (2026-09-16)

**Context:** `unused_files_pythonBridge_flow.txt` (repo root) traced the
pythonBridge.js -> engine_main.py call graph and flagged orphaned modules.
Re-checked its findings against the current codebase before touching
anything, since parts of it were already stale (Group A's
`services/engine/{transcriber,client,config,pipeline,resemblyzer_diarizer,
main,python_main}.py` etc. have already been deleted — confirmed by
`services/engine/__init__.py`'s own docstring describing that earlier
cleanup — and `task/tutor_eval_task.py` no longer exists either, so the doc's
task-DAG description is partly out of date).

- [x] Confirmed `services/engine/services/ai_audit.py` (`AuditService` — name
      collision with, but NOT the same class as, the canonical
      `services.engine.audit_service.AuditService`) and
      `services/engine/services/audit_worker.py` (`AiAuditService`) are still
      present and still eagerly imported by
      `services/engine/services/__init__.py`, even though
      `services/engine/task/audit_task.py` has an explicit comment saying not
      to import them because they're legacy duplicates with different
      scoring math, no longer wired into the pipeline.
- [x] Grepped everything staged so far (task/, orchestrator/, tools/,
      engine_main.py, test_ai_evaluation.py) for any reference to
      `AiAuditService` / `ai_audit` / `audit_worker` outside that one
      `__init__.py` — found none.
- [x] Removed the two eager imports (`AiAuditService`, `ai_audit.AuditService`)
      and their `__all__` entries from
      `services/engine/services/__init__.py`, with a comment explaining why.
      Left `ai_audit.py` and `audit_worker.py` themselves in place (not
      deleted) — this only stops them from being loaded into memory on every
      engine run; either can still be imported directly by module path if
      ever needed.
- [x] Syntax-checked the edited `__init__.py`.
- [ ] Not done: a full runtime smoke test of the engine (`node test-engine.js
      <id>` / `python engine_main.py`) — this sandbox doesn't have the
      project's DB/env configured. **Recommend running one real session
      through the pipeline on your machine** to confirm nothing implicitly
      relied on `services.engine.services.AiAuditService` /
      `.AuditService` being importable from the package root before
      considering this fully verified.
- [x] Deleted (by project owner, in File Explorer, 2026-09-16), after
      re-verifying each one specifically (not just trusting
      `unused_files_pythonBridge_flow.txt`, which was partly stale — see
      correction below):
        - `audit_bridge.py` (repo root) — its own header comment already
          said "Nothing in the current codebase invokes this script
          (confirmed via a repo-wide search)"; standalone CLI only.
        - `services/engine/services/ai_audit.py` — its only documented
          caller was `audit_bridge.py` (`# RUN AUDIT (called by
          audit_bridge.py)`).
        - `services/engine/services/audit_worker.py` — the implementation
          underneath `ai_audit.py`; `services/engine/task/audit_task.py`
          explicitly warns not to import it ("legacy duplicate
          implementations with different scoring math ... no longer wired
          into the pipeline"). Confirmed via grep that nothing else in
          controllers/, routes/, task/, orchestrator/, tools/, app.py,
          engine_main.py, or test_ai_evaluation.py references any of the
          three.
      Their stale `__pycache__/*.pyc` are harmless leftovers, not cleaned up
      (Python just won't regenerate them until it needs to).

- [x] **Correction, left here so the mistake doesn't get repeated:**
      `services/python_deepgram/*` (also flagged as dead in
      `unused_files_pythonBridge_flow.txt`) was checked with the same
      rigor and turned out to be the opposite of dead — it's an actively
      developed Deepgram-based transcription + name-detection feature
      (`requirements.txt` documents `name_detector.py` as live, and the
      folder gained `name_detector.py`/`participants_repo.py` well after
      that doc was written). **Do not delete `services/python_deepgram/`**
      based on that doc's claim — it does not hold up.

## Microsoft Calendar integration (2026-09-16)

**Goal:** Add a Microsoft (Outlook/Teams) Calendar integration that mirrors
the existing Google Calendar integration end-to-end — same layered pattern
(HTML -> JS -> Routes -> Controllers -> Models -> DB), same instructor
self-connect + admin-triggered-connect + background-sync flows. Built by
reading every layer of the Google implementation first
(`controllers/instructor/instructorCalendarController.js`,
`controllers/calendar/CalendarEventController.js`,
`models/calendar/CalendarUsersModel.js`, `models/calendar/CalendarAuthModel.js`,
`models/calendar/GoogleOAuthCredentialsModel.js`, the `google-credentials`/
`calendar`/`instructor/calendar` routes, `public/js/admin/people/users.js`,
`public/instructor/index.html` + its JS) before writing anything new.
Schema-wise this reuses the already-provider-agnostic `calendar_connections`
table and the `'teams'` provider row already seeded by
`database/seeders/016_calendar_providers.js` — no new connections table
needed. No new npm dependency: Microsoft Graph is called with `axios`
(already a dependency), unlike Google which uses the `googleapis` SDK.

- [x] Read every layer of the Google integration (routes, controllers,
      models, migrations, seeders, public HTML/JS) to confirm the pattern
      to mirror, and confirmed `calendar_connections` / `calendar_providers`
      are already provider-agnostic (the `'teams'` row already has
      Microsoft OAuth URLs/scopes in its `config_json`).
- [x] `database/migrations/058_create_microsoft_oauth_credentials_table.js`
      — mirrors migration 021 (Google OAuth credentials table).
- [x] `models/calendar/MicrosoftOAuthCredentialsModel.js` +
      `models/super_admin/calendar/MicrosoftOAuthCredentialsModel.js` —
      env-var-only credential config (`MICROSOFT_CLIENT_ID`/`_SECRET`),
      same pattern as the Google credentials models.
- [x] `models/calendar/MicrosoftCalendarAuthModel.js` — `PROVIDER_NAME =
      'teams'`, token get/save/delete against `calendar_connections`.
- [x] `models/calendar/CalendarUsersModel.js` — added
      `getUserByProviderName`, `getUserByEmailAndProviderName`,
      `deleteUserProvider` (provider-scoped, so Microsoft disconnect never
      touches a user's Google row or vice versa). Also fixed a latent bug
      in `getConnectedUsers()`: it deduped background-sync candidates by
      `user_id` alone, which would have silently dropped one of a user's
      two simultaneous connections (Google + Microsoft) — changed the
      dedup key to `user_id + ':' + provider_id`.
- [x] `controllers/calendar/MicrosoftCalendarEventController.js` — axios
      mirror of `CalendarEventController.js` against Microsoft Graph
      (`getAuthUrl`, `ensureValidToken`, `getEvents`, `createEvent`,
      `authorize`, `processAndStoreEvents`). Normalizes Graph event shape
      (`subject`/`body`/`onlineMeeting.joinUrl`/...) into the same
      `{summary, description, location, start, end, hangoutLink}` shape
      Google events use, so the existing `utils/calendarHelper.js` meeting
      extraction works unchanged for both providers.
- [x] `controllers/microsoft/microsoftCredentialsController.js` +
      `controllers/super_admin/microsoft/microsoftCredentialsController.js`
      — mirrors the Google credentials CRUD controllers (skipped masking
      a `project_id` field since that column doesn't actually exist on
      the Google side either — not replicating that pre-existing dead
      reference).
- [x] `controllers/instructor/instructorMicrosoftCalendarController.js` —
      full mirror of `instructorCalendarController.js`: `listConnections`,
      `sendVerification`, `selfRequest`, `verifyToken`, `handleCallback`,
      `disconnect`, `getStatus`, `syncCalendar`. Uses its own JWT purpose
      (`instructor-calendar-verify-microsoft`) so a Microsoft verify link
      can't be replayed against the Google flow or vice versa. Route uses
      `/status/:emailOrUserId` matching what the controller actually
      reads — deliberately NOT replicating a pre-existing Google route/
      controller param-name mismatch (`routes/instructor/calendar.js`
      defines `/status/:email` but the Google controller reads
      `req.params.emailOrUserId`, always undefined there).
- [x] `controllers/calendar/CalendarSyncController.js` — added provider
      branching (`syncUserCalendar` now picks
      `MicrosoftCalendarEventController` vs `CalendarEventController`
      based on `user.provider_name`/`user.provider`, defaulting to Google
      for backward compatibility with existing callers).
- [x] `controllers/instructor/instructorCalendarController.js` — one-line
      change so the admin single-user "Calendar Sync" button passes
      `provider_name` through to `CalendarSyncController.syncUserCalendar`,
      so it routes correctly for Microsoft-connected instructors too.
- [x] `services/calendarSyncService.js` — added `syncMicrosoftCalendar()`,
      mirroring `syncGoogleCalendar()`'s 6-step structure (get tokens ->
      refresh if expired -> fetch events -> loop -> skip invalid/all-day
      -> upsert into `meetings` with `platform: 'Microsoft Calendar'`).
- [x] `routes/microsoft-credentials.js` — mirrors `google-credentials.js`
      (super-admin-only CRUD), registered in `routes/registry.js`.
- [x] `routes/instructor/microsoft-calendar.js` — mirrors
      `instructor/calendar.js`; owns `/verify` and `/callback` directly
      (no legacy-shim constraint, since this is a brand-new Azure AD app
      registration with its own redirect URI). Mounted in
      `routes/instructor/index.js`.
- [x] `routes/meetings-calendar.js` — added
      `POST /send-verification-microsoft` (admin-triggered connect,
      mirrors the existing Google endpoint) calling
      `instructorMicrosoftCalendarController.sendVerification`.
- [x] `config/settings.js` — added a `microsoft: { CLIENT_ID, CLIENT_SECRET,
      TENANT_ID }` block reading new env vars.
- [x] `.env.example` — documented the new `MICROSOFT_CLIENT_ID`,
      `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`,
      `MICROSOFT_REDIRECT_URIS`, `MICROSOFT_SCOPES`, and optional
      `MICROSOFT_AUTH_URI`/`MICROSOFT_TOKEN_URI`/`MICROSOFT_GRAPH_BASE_URL`/
      `MICROSOFT_OAUTH_BASE_URL` overrides.
- [x] `public/js/admin/people/users.js` — added a second "Connect
      Microsoft" button next to the existing "Connect Google" button in
      the instructor Actions column, posting to
      `/api/admin/meetings/calendar/send-verification-microsoft`.
      Confirmed `public/admin/settings/integrations.html`/`.js` and
      `public/js/admin/meetings/calendar.js` needed **no changes** — both
      are already fully provider-agnostic (the calendar page even already
      has `teams`/`microsoft` color theming built in) and will pick up
      real Microsoft connections automatically once they exist in
      `calendar_connections`.
- [x] `public/instructor/index.html` — added a second, independent
      `msCalendarBanner` block (own OAuth connection, same structure as
      the Google banner, `ms`-prefixed IDs) directly below the existing
      Google calendar banner.
- [x] `public/js/instructor/index.js` — added a second IIFE wiring the
      `msCalendarBanner` elements to `/api/instructor/microsoft-calendar/*`
      (connections/self-request/disconnect), mirroring the existing
      Google block's `setState()`/`checkStatus()` pattern exactly.
- [x] Syntax-checked every new/modified `.js` file (`node --check`) — all
      pass.
- [ ] **Requires the project owner:** register a real Azure AD (Microsoft
      Entra ID) app — needs `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
      `MICROSOFT_TENANT_ID` (or leave `common` for multi-tenant/personal
      accounts), and a redirect URI of
      `http://localhost:3000/api/instructor/microsoft-calendar/callback`
      (or the deployed host's equivalent) registered on the app. I cannot
      create this app registration — it requires the owner's Azure/Microsoft
      365 admin access.
- [ ] Run migration 058 (`microsoft_oauth_credentials` table) as a
      **standalone one-off**, not via `npm run db:reset`/`db:migrate` —
      those wipe the entire database and must never be run on a live DB.
- [ ] Run `.\generate_structure.ps1` (or `npm run structure:update`) after
      the new files land, per project rules.
- [ ] Not done, out of scope unless requested: a super-admin HTML settings
      page for Microsoft OAuth credentials. Deferred to match parity with
      Google, which also has no such page (`google-credentials.js` on the
      super-admin side is orphaned — no HTML references it either).
- [ ] End-to-end smoke test on the real machine once the Azure app and env
      vars are in place: connect flow, callback, token refresh, background
      sync, disconnect.

## Super Admin: enable/disable toggle for Google/Microsoft Calendar (2026-09-16)

**Goal:** Replace the hardcoded JS "hide Microsoft" approach above with a
proper super-admin control that can enable/disable each calendar OAuth
provider platform-wide, enforced on the backend (not just hidden in the
UI). Confirmed `calendar_providers.is_active` already exists and is already
the field `CalendarVerificationModel`/`CalendarAuthModel` resolve against
(`'google-meet'` = Google Calendar, `'teams'` = Microsoft Calendar) — no
schema change needed, `CalendarProvidersModel` already supports reading/
updating it. Deliberately NOT the existing "Platform Integrations" super
admin page (`settings/platforms`) — that page manages a separate,
unrelated feature (meeting-bot join platforms via a generic settings
table), confirmed by reading its controller/model before touching anything.

- [x] `controllers/instructor/instructorCalendarController.js` —
      `sendVerification` and `selfRequest` now check `calendar_providers`
      (`'google-meet'`) `is_active` and return 403 "Google Calendar
      integration is currently disabled by the administrator" if off.
- [x] `controllers/instructor/instructorMicrosoftCalendarController.js` —
      same check against `PROVIDER_NAME` (`'teams'`) in both endpoints.
- [x] `controllers/calendar/calendarIntegrationController.js` — added
      `getProviderFlags` (any authenticated role, not admin-only) returning
      `{ google, microsoft }` booleans — the single source of truth the
      instructor/admin frontend JS reads to decide whether to show Connect
      buttons. Routed at `GET /api/calendar-integrations/provider-flags`
      (`routes/calendar-integrations.js`).
- [x] New `controllers/super_admin/settings/calendar-integrations/calendarIntegrationsController.js`
      — `getSettings` (list both managed providers + their `is_active`) and
      `toggleProvider` (flip one, hard-scoped to only the `'google-meet'`/
      `'teams'` rows — cannot be used to touch the `'zoom'` row owned by
      the Platform Integrations page). No new model — reuses
      `CalendarProvidersModel` directly (already had everything needed).
- [x] New `routes/super_admin/settings/calendar-integrations.js`, mounted
      in `routes/super_admin/index.js` at
      `/api/super_admin/settings/calendar-integrations` (super_admin-only).
- [x] New `public/super_admin/settings/calendar-integrations.html` +
      `public/js/super_admin/settings/calendar-integrations.js` — two
      cards (Google Calendar / Microsoft Calendar), each with a single
      Enabled toggle that saves immediately on change (simpler than the
      Platform Integrations page's batch "Save Changes", since there's
      only one field per card here).
- [x] `public/js/instructor/index.js` — replaced the hardcoded
      `MICROSOFT_CALENDAR_ENABLED = false` flag (and the previously
      always-on Google banner) with a shared `getCalendarProviderFlags()`
      fetch consulted by both the Google and Microsoft banner blocks.
      Fails open for Google, closed for Microsoft, on a network error.
- [x] `public/instructor/index.html` — `#msCalendarBanner` starts with a
      `hidden` class as the pre-JS default (Google's banner does not,
      since it fails open) — both are then shown/hidden for real by the
      fetched flags once JS runs.
- [x] `public/js/admin/people/users.js` — added `loadCalendarProviderFlags()`
      alongside the existing `loadCalendarConnections()` call in
      `loadUsers()`; both "Connect Google" and "Connect Microsoft" buttons
      in the instructor Actions column now only render when their
      provider's flag is on.
- [x] `database/seeders/017_menu_items.js` / `018_role_menu_permissions.js`
      — added the `sa-calendar-integrations` sidebar entry (for fresh
      installs only — these are seed-once scripts).
- [ ] **Requires the project owner:** these two seeders won't touch an
      already-seeded database. Run the new standalone, idempotent script
      once to add the sidebar entry to the live DB:
      `node database/one-off/insert_calendar_integrations_menu_item.js`
      (safe to re-run — it checks for the menu item first and no-ops if
      already present). Do NOT run `npm run db:reset`/`db:migrate`.
- [x] Syntax-checked every new/modified `.js` file (`node --check`) — all
      pass.
- [ ] Run `.\generate_structure.ps1` (or `npm run structure:update`) after
      the new files land, per project rules.
- [ ] Not yet manually tested end-to-end (toggling off actually blocks
      connect on both UI and API, toggling back on restores it) — needs a
      real run once the one-off script above has been applied.
- [x] **Bug found + fixed (2026-09-16):** owner ran the one-off script and
      `generate_structure.ps1` — sidebar link appeared, but clicking it
      just showed the dashboard instead of the new page. Root cause:
      `models/super_admin/SuperAdminPageModel.js` has an explicit allowlist
      (`getPages().nested.settings`) of which `public/super_admin/*.html`
      files `routes/super_admin/pages.js` is allowed to serve — a security
      measure against arbitrary path requests. `calendar-integrations` was
      never added to that list, so `resolveNestedFile()` returned null and
      `superAdminPageController.serveOrFallback()` silently fell back to
      the dashboard instead of erroring. Fixed by adding
      `'calendar-integrations'` to that array. **Owner needs to restart the
      Node server** (not just refresh the browser) for this to take effect,
      since the allowlist is loaded into memory once at startup.

**Note:** this whole TODO.md entry was re-written on 2026-09-16 after the
first attempt to save it silently didn't stick on disk (re-staging showed
the file back at its pre-edit byte count despite the commit reporting
success) — same unexplained-revert pattern seen earlier with
`public/js/instructor/index.js` etc. If entries below this note ever look
like they've gone missing again, that's the likely cause — not an
intentional revert.

## Super Admin: make the Platform Integrations toggle (Zoom/Google Meet/Teams)
actually enforce bot behavior (2026-09-16)

**Finding: it did nothing.** `super_admin/settings/platforms` writes
`system_settings` rows (`platforms.<zoom|teams|google-meet>.enabled`, string
`'true'`/`'false'`) via `PlatformsModel.saveSettings()`, but nothing ever
read them back before this task. Verified by reading, in full:
- `controllers/meetings/BotPollingController.js` — the 10s auto-join poll
  loop (`pollQueuedMeetings()`) had no check of any kind against
  `system_settings` before calling `botManager.launchFromDb(meeting)`.
- `services/featureConfig.js` — a separate, hardcoded, non-DB, non-UI
  per-platform config (mic/camera/recording toggles). Confirmed this is NOT
  what the Platforms settings page controls and left it untouched.
- `services/platforms/platformFactory.js` — confirmed the canonical
  lowercase platform keys (`'zoom'`, `'teams'`, `'google-meet'`) match both
  `meeting.platform` (DB) and the `platforms.<key>.enabled` setting-key
  format exactly, so no key translation was needed.

**Bug found along the way:** `models/settings/SystemSettingsModel.js`'s
existing `getSetting(companyId, key)` binds `company_id = ?`. Every
Platforms setting is saved with `company_id = null`
(`PlatformsModel.saveSettings` → `upsertSetting(null, ...)`), and in SQL
`company_id = NULL` never matches — not even NULL rows. So
`getSetting(null, key)` would have silently returned nothing for every
platform setting. Did not call it; added a key-only lookup instead (below).

**Implemented (no SQL added to any controller — all reads go through
Models):**
- [x] `models/settings/SystemSettingsModel.js` — added
      `getSettingByKey(key)`, a key-only lookup (`WHERE setting_key = ?`,
      no `company_id` comparison), avoiding the NULL-match bug above.
- [x] `models/super_admin/settings/platforms/PlatformsModel.js` — added
      `isPlatformEnabled(platformKey)` (single-platform check, used by the
      manual join endpoint) and `getEnabledPlatformsMap()` (one query
      returning all three platforms' enabled state, used by the poll loop
      so it isn't one query per queued meeting). Both default a platform to
      **enabled** when no setting row exists yet, so nothing breaks for an
      admin who has never touched the page.
- [x] `controllers/meetings/BotPollingController.js` — `pollQueuedMeetings()`
      now fetches `getEnabledPlatformsMap()` once per poll cycle (only when
      there's something queued) and skips launching any meeting whose
      `platform` is explicitly disabled. The skip leaves the meeting's
      status as `'queued'` (no DB write) rather than failing/expiring it, so
      it launches automatically the instant the platform is re-enabled —
      but it still ages into `'expired'` via the existing timeout check if
      it's never re-enabled, so nothing queues forever.
- [x] `controllers/meetings/meetingsController.js` — the manual
      `POST /join` endpoint (`join()`, used for on-demand/dashboard bot
      launches outside the calendar-sync queue) now checks
      `PlatformsModel.isPlatformEnabled()` and returns `403` with a clear
      message if the platform is disabled, before calling
      `PlatformFactory.startBot()`.
- [x] Syntax-checked all four changed files (`node --check`) — all pass.
- [ ] Not yet manually tested end-to-end (toggle a platform off in
      Super Admin > Settings > Platform Integrations, confirm a queued
      meeting for that platform is skipped by the poller and the manual
      join API returns 403; toggle back on and confirm it launches).
- [ ] No new/removed/renamed files this task, so `generate_structure.ps1`
      was not run (nothing for it to pick up).

## Platform Integrations page: stop hardcoding the platform list in JS
(2026-09-16)

**Ask:** the page already read real toggle/field values from
`system_settings` (verified in the task above), but which platforms exist
and their display labels were hardcoded in
`public/js/super_admin/settings/platforms.js` (`PLATFORM_DEFS`). Owner
pointed out `calendar_providers` already has this data (it seeds exactly
`zoom` / `google-meet` / `teams` with `name` + `display_name` — see
`database/seeders/016_calendar_providers.js`) and asked for it to be read
from there instead.

**Important distinction preserved:** `calendar_providers.is_active` is the
separate Calendar OAuth integration on/off switch (built earlier this
session) — unrelated to this bot-launch Platforms page. Only read
`name`/`display_name` from that table here; never touched `is_active`, and
fetch with `includeInactive: true` so a platform still shows on this page
even if its Calendar OAuth connector happens to be off.

- [x] `controllers/super_admin/settings/platforms/platformsController.js`
      — `getSettings` now also calls `CalendarProvidersModel.getAll({
      includeInactive: true })` and returns `providers: [{name,
      display_name}]` alongside the existing `system_settings` rows.
- [x] `public/js/super_admin/settings/platforms.js` — removed the
      `PLATFORM_DEFS` object entirely. The platform list + label now come
      from `providers`; the set of configurable fields per platform, their
      current values, and editability now come entirely from whichever
      `system_settings` rows exist for that platform (previously a fixed
      per-platform `fields` array). Field type (toggle vs text) is inferred
      generically from the stored value (`'true'`/`'false'` ⇒ toggle);
      field labels are humanized from the setting key (e.g.
      `auto_enable_captions` → "Auto Enable Captions") instead of
      hand-written per-field text. Icon glyph/color are now generic
      (first letter of the label + a rotating color palette) since no DB
      column represents those — pure presentation, not data.
  - Kept one narrow carve-out from the old behavior: `base_url` is still
    forced non-editable (`LOCKED_FIELD_KEYS`), same as before, since it's
    wired into the platform adapters elsewhere and wasn't part of what was
    asked to change.
  - `saveAllPlatforms()` reworked to collect every `[data-setting-key]`
    element in the DOM instead of iterating a hardcoded per-platform field
    list, so it stays correct no matter which fields a platform actually
    has in the DB.
  - The Recording Settings card was changed the same way for consistency
    (labels humanized from `recording.*` keys instead of a hardcoded
    `RECORDING_DEFS.fields` array); its outer card title ("Recording
    Settings") stayed static since it's a section heading, not per-item
    data.
- [x] Checked `public/super_admin/settings/platforms.html` — it only
      contains an empty `#platformsGrid` container filled by the JS, no
      hardcoded platform markup to update.
- [x] Syntax-checked both changed files (`node --check`) — pass.
- [ ] Not yet manually tested in the browser (load the page, confirm all
      three platforms + their real field values render, toggle+save a
      value, confirm a newly-added `calendar_providers` row would appear
      automatically without a code change).
- [ ] No new/removed/renamed files this task, so `generate_structure.ps1`
      was not run.


## Wire AI Providers settings (DB) into the real bot/AI engine (2026-09-16)

**Problem:** Super Admin > Settings > AI Providers page reads/writes the
`ai_providers` table, but `services/engine/ai_client.py` (the actual
Python code that calls the LLM during the AI audit) read provider, model,
API keys, and max-tokens entirely from `.env` and never queried the
`ai_providers` table — so toggling "Enabled", changing "Model", or editing
"Temperature"/"Max Tokens" on the settings page had zero effect on the bot.
Also, `default_temperature` was stored in the DB but was never passed to
any provider's API call at all (anthropic/gemini/openai/ollama), DB-driven
or not.

- [x] Confirm `database/python_db.py` (`fetch_all`, via `from database.python_db
      import fetch_all`) is usable from `services/engine/*.py` — verified via
      existing convention in `services/engine/audit_storage.py` and the
      `PYTHONPATH=PROJECT_ROOT` env set in `python_runner.js`.
- [x] Add `_load_enabled_provider_from_db()` to `ai_client.py`: queries
      `ai_providers` for `enabled = 1` rows. Only returns a row when
      **exactly one** is enabled (unambiguous). Zero enabled rows, more than
      one enabled row, or any DB error all return `None` and are logged —
      never raised.
- [x] `AiClient.__init__` now uses the DB row's `provider_key`/`default_model`
      when available, else falls back to the original `.env` (`AI_PROVIDER`,
      `<PROVIDER>_MODEL`) behavior, completely unchanged.
- [x] Added `self.temperature` / `self.max_tokens` resolution from the DB
      row's `default_temperature`/`default_max_tokens` (only set when the DB
      override applies; `None` otherwise, preserving old per-provider
      defaults).
- [x] `_ask_anthropic`: passes `temperature` when resolved; `max_tokens` now
      prefers the resolved value over `ANTHROPIC_MAX_TOKENS` env var.
- [x] `_ask_gemini_with_key`: passes `temperature` in `config_kwargs`;
      `max_output_tokens` now prefers the resolved value over
      `GEMINI_MAX_OUTPUT_TOKENS` env var.
- [x] `_ask_openai_like` / `_ask_ollama`: now pass `temperature`/`max_tokens`
      to `chat.completions.create(...)` when resolved (previously passed
      neither, ever).
- [x] Syntax-checked (`python3 -c "import ast; ast.parse(...)"`).
- [x] Fixed `database/seeders/019_seed_ai_providers.js` so only `openai`
      seeds `enabled: 1` (matches `ai_client.py`'s own `.env` fallback
      default) — fresh installs now have an unambiguous single active
      provider from the start instead of all four enabled at once.
- [x] User pointed out this project uses seeders, not a `database/one-off/`
      folder, for this kind of fix — merged both fixes (icon values +
      enabled ambiguity) directly into `database/seeders/019_seed_ai_providers.js`
      as a `normalizeExistingRows()` step that runs on every execution (not
      just the insert-if-missing loop), so re-running the seeder fixes an
      already-seeded database too. Re-apply with:
      `node database/seeders/019_seed_ai_providers.js`
      The two `database/one-off/fix_ai_provider_*.js` scripts are now
      superseded by this. User deleted `database/one-off/` themselves
      (this session has no delete access on their machine).
- [x] User ran `npm run structure:update` — `project_structure_only.txt`
      regenerated to reflect the `database/one-off/` folder deletion.
- [x] Committed all files to device and verified each write actually landed
      (re-staged + grepped/checked byte counts — device_commit_files has been
      silently reverting some writes this session; retried with `force:
      true` where needed).

**How to apply this on your live DB (run once):**
```
node database/seeders/019_seed_ai_providers.js
```
This fixes the icon values AND disables every `ai_providers` row except
`openai`, so the table ends up with exactly one enabled row and
`ai_client.py` starts honoring it immediately (no restart needed — the DB
is read fresh on every audit run). After that, go to Super Admin > Settings
> AI Providers if you want a *different* provider active — toggling one on
there already unchecks the others and saves back to this same table.

## Bot Configuration page: check DB-dynamic + real bot usage, remove dead sections (2026-09-16)

**Investigation:** Super Admin > Settings > Bot Configuration
(`/super_admin/settings/bot-configuration`) is genuinely DB-dynamic —
HTML -> JS -> `routes/super_admin/settings/bot-configuration.js` ->
`controllers/.../botConfigController.js` -> `BotConfigModel.js` ->
`SystemSettingsModel.js` -> `system_settings` table, all real, no
hardcoding. BUT the actual bot process (`services/shared/botManager.js`,
`browserManager.js`, `services/socraticbot.js`, `services/platforms/
audioRecorder.js`, `screenRecorder.js`) reads exclusively from
`config/settings.js` (hardcoded literals + `process.env`), never from
`system_settings`/`SystemSettingsModel`/`BotConfigModel` — so none of the
Puppeteer/Audio/Screen fields on this page had any effect on bot behavior.
The Bot Engine / Error Handling / Advanced sections have no backing
implementation anywhere in the bot code either.

- [x] Traced all 5 layers to confirm the page itself is genuinely
      DB-dynamic (not hardcoded).
- [x] Traced the real bot process's config source (`config/settings.js`)
      and confirmed zero references to `system_settings`/
      `SystemSettingsModel` anywhere in the files that actually launch/run
      bots.
- [x] User asked to remove the Puppeteer Configuration, Audio
      Configuration, and Screen Configuration sections (the ones that
      looked most obviously tied to real bot internals but were fully
      cosmetic).
- [x] `public/super_admin/settings/bot-configuration.html` — removed all
      three `<div>` sections (Puppeteer, Audio, Screen) and their inputs
      (`defaultViewport`, `protocolTimeout`, `slowMo`,
      `ignoreDefaultArgs`, `userDataDir`, `headlessMode`, `chromeArgs`,
      `audioDeviceName`, `audioBitrate`, `audioSampleRate`,
      `audioChannels`, `audioFormat`, `audioEnhancement`, `audioFilters`,
      `screenFramerate`, `screenCrf`). Bot Engine Settings, Error Handling
      & Retries, and Advanced Settings sections kept unchanged.
- [x] `public/js/super_admin/settings/bot-configuration.js` — removed the
      corresponding entries from `saveAllSettings()`'s `settings` array and
      from `resetToDefaults()`. `loadBotSettings()` needed no change — it
      already looks up DOM elements generically by `setting_key` and
      silently skips any row with no matching element on the page.
- [x] Checked `controllers/.../botConfigController.js` — no hardcoded
      field list there, purely pass-through to the model, so no
      controller/model change needed.
- [x] Syntax-checked the JS (`node --check`).
- [x] Committed both files and verified each landed (re-staged + checked
      byte counts; JS needed one forced retry due to this session's
      recurring flaky-write issue).

**Note:** the underlying `bot.default_viewport`, `bot.audio_bitrate`, etc.
rows still exist in `system_settings` (not deleted) — they're just no
longer shown or saved from this page. Not touched since removing DB rows
wasn't asked for and this project's rules require an explicit, separate
decision before bulk-modifying data.

- [ ] Not yet decided: whether to also wire the *real* bot config
      (`config/settings.js` -> `botManager.js`/`browserManager.js`/etc.)
      into the DB the way `ai_client.py` was wired to `ai_providers`, for
      the Bot Engine / Error Handling / Advanced sections that remain on
      the page (their fields currently have no backing implementation in
      the bot code at all) — not asked for yet.

## Wire real bot timing (config/settings.js) into Bot Configuration DB settings (2026-09-16)

**Request:** the 4 timing env vars (`BOT_HOST_WAIT_TIMEOUT_MS`,
`HUMAN_JOIN_TIMEOUT_MS`, `BOT_LAUNCH_LEAD_MINUTES`,
`BOT_QUEUED_EXPIRE_MINUTES`) that `config/settings.js`'s `bot` block reads
should become configurable from Super Admin > Settings > Bot Configuration,
backed by the DB — same pattern as the earlier AI Providers -> ai_client.py
wiring.

**Investigation first** (via subagent, read-only):
- `services/featureConfig.js` is unrelated (per-platform mute/camera/
  monitor toggles, not timing) — ruled out as a target.
- `config/settings.js` lines 250-275 were confirmed as the single real
  source: `bot.hostWaitTimeoutMs` (`BOT_HOST_WAIT_TIMEOUT_MS`, default
  900000ms), `bot.humanJoinTimeoutMs` (`HUMAN_JOIN_TIMEOUT_MS` falling back
  to `BOT_HOST_WAIT_TIMEOUT_MS` falling back to 60000ms),
  `bot.autoJoinLeadMinutes` (`BOT_LAUNCH_LEAD_MINUTES`, default 3, floor of
  1), `bot.queuedExpireMinutes` (`BOT_QUEUED_EXPIRE_MINUTES`, default 5).
- Real consumers, all reading the `settings.bot.*` property (not raw
  `process.env`): `services/platforms/zoom/zoomJoiner.js`,
  `services/platforms/teams/teamsJoiner.js`,
  `services/platforms/google-meet/meetingNavigation.js` (hostWaitTimeoutMs);
  `services/socraticbot.js` (humanJoinTimeoutMs);
  `controllers/meetings/BotPollingController.js` +
  `models/meetings/MeetingModel.js` (autoJoinLeadMinutes,
  queuedExpireMinutes).
- Existing Bot Configuration page fields (`bot.launch_window`,
  `bot.timeout`) look similar but are pre-existing, unconnected,
  different-unit keys (minutes vs ms mismatch for `bot.timeout` vs
  `BOT_HOST_WAIT_TIMEOUT_MS`) — deliberately NOT repurposed; 4 new
  `bot.*` keys were added instead to avoid a silent unit/semantics bug.
- Flagged (not fixed, out of scope): `loadBotSettings()` in the page's JS
  has a pre-existing bug where it expects DOM element ids to literally
  equal the un-prefixed `setting_key` (e.g. `auto_launch`), but the
  existing 11 fields use camelCase ids (`botAutoLaunch` etc.) that never
  match, so those 11 fields silently never populate from the DB on page
  load (they still save correctly, just don't re-load). The 4 new fields
  below were deliberately given ids that DO match their un-prefixed keys
  so they don't have this problem.

**Implementation:**
- [x] `config/settings.js` — added a `_botDbCache` object + lazy
      `_refreshBotDbCache()` (requires `models/settings/SystemSettingsModel`
      only inside the function, wrapped in try/catch) that reads
      `bot.host_wait_timeout_ms` / `bot.human_join_timeout_ms` /
      `bot.launch_lead_minutes` / `bot.queued_expire_minutes` from
      `system_settings` every 60s (timer `.unref()`'d so it never holds a
      short-lived script open). Converted `hostWaitTimeoutMs`,
      `humanJoinTimeoutMs`, `autoJoinLeadMinutes`, `queuedExpireMinutes` in
      the `bot` block from plain values to `get` accessors that check the
      cache first and fall back to the exact original `.env`/hardcoded
      chain otherwise. Zero changes needed in any consumer file (they all
      just read `settings.bot.xxx` as a property, unchanged) — same
      conservative "DB is an enhancement, never load-bearing" design as
      `ai_client.py`'s `_load_enabled_provider_from_db()`.
- [x] `public/super_admin/settings/bot-configuration.html` — added a new
      "Bot Timing" section (indigo) with 4 fields: Host Wait Timeout (ms),
      Human Join Timeout (ms), Launch Lead Time (minutes), Queued Expiry
      (minutes). Field ids (`host_wait_timeout_ms`, `human_join_timeout_ms`,
      `launch_lead_minutes`, `queued_expire_minutes`) intentionally equal
      their un-prefixed `setting_key` so `loadBotSettings()`'s existing
      lookup actually populates them (unlike the pre-existing 11 fields —
      see note above). Default input values match the user's current
      `.env` (900000 / 600000 / 3 / 50).
- [x] `public/js/super_admin/settings/bot-configuration.js` — added the 4
      new keys (`bot.host_wait_timeout_ms` etc.) to `saveAllSettings()`'s
      `settings` array and to `resetToDefaults()`.
- [x] Checked `controllers/.../botConfigController.js` and
      `models/super_admin/settings/bot-configuration/BotConfigModel.js` —
      both generic pass-throughs (`LIKE 'bot%'` / per-item upsert), no
      changes needed for new keys under the existing `bot.` prefix.
- [x] Syntax-checked `config/settings.js` and the JS file (`node --check`).
- [x] Committed all 3 files and verified each landed (re-staged + checked
      byte counts — all landed cleanly this time, no forced retries
      needed).

**How this behaves:** until an admin saves this page at least once, the
new DB rows don't exist yet, so `_botDbCache` stays all-`null` and the bot
keeps using exactly the same `.env` values as before — zero behavior
change out of the box. The first time Bot Timing is saved on this page,
those 4 values start overriding `.env` within 60 seconds (the cache
refresh interval), no restart required.

## Remove Access Control page + sidebar entry (2026-09-16)

**Request:** fully remove `/super_admin/people/access-control` (a user
account list/edit/deactivate/reset-password page, NOT the same thing as
the `access_control` settings-group keys in `007_settings.js` — those are
a separate, unrelated, already-inert set of settings; confirmed via repo-
wide grep that nothing reads them anywhere, including this page's own
controller/model, so deleting this page has zero effect on them), plus its
side-menu entry.

**Investigation first** (via subagent, read-only) confirmed the full
inventory: HTML/JS/route/controller/model are access-control-specific and
safe to delete; the underlying shared models (RolesModel, CompaniesModel,
UsersModel) it calls into are used extensively elsewhere and must NOT be
touched. Sidebar entry exists in 3 places (canonical `017_menu_items.js`,
`018_role_menu_permissions.js`, and the already-deprecated
`009_header_menu_items.js`), plus a page-header metadata entry in
`010_header_page_configs.js`. Critically: the sidebar is rendered live from
the `menu_items`/`role_menu_permissions` DB tables (via `MenuModel`), and
`010`'s page metadata is served live from `header_page_configs` — editing
the seeder source files alone would NOT remove anything from an
already-seeded live database (same "seeder edit isn't enough" pattern
as the earlier `ai_providers` icon fix).

- [x] `database/seeders/017_menu_items.js` — removed the `sa-access-control`
      entry from `MENU_ITEMS`. Added `removeStaleMenuItems()` (deletes
      `role_menu_permissions` rows for the item first, then the
      `menu_items` row itself) that runs on every execution of this
      seeder (not gated by its usual "skip if already seeded" check), so
      re-running it also cleans up an already-seeded install. Re-apply
      with: `node database/seeders/017_menu_items.js`
- [x] `database/seeders/018_role_menu_permissions.js` — removed the
      `['sa-access-control', 'sa-people']` hierarchy entry. No live-DB
      action needed here since `017`'s cleanup above already deletes the
      corresponding `role_menu_permissions` row.
- [x] `database/seeders/010_header_page_configs.js` — removed the
      `accessControl` page-metadata entry from `DEFAULT_PAGES`. Added
      `removeStalePageConfigs()` (deletes `header_page_configs` rows by
      `page_key`) that runs on every execution (this seeder uses
      `INSERT IGNORE` and has no skip gate, but never removed rows either).
      Re-apply with: `node database/seeders/010_header_page_configs.js`
- [x] `database/seeders/009_header_menu_items.js` — removed the matching
      entry too, for consistency, even though this file is already marked
      DEPRECATED/reference-only and needs no live-DB action.
- [x] `routes/super_admin/index.js` — removed the `accessControl` require
      and its `router.use('/people/access-control', ...)` mount.
- [x] `models/super_admin/SuperAdminPageModel.js` — removed `'access-control'`
      from the `people` nested-pages array (so `/super_admin/people/
      access-control` correctly 404s/falls through instead of resolving to
      a file once that file is gone).
- [x] Syntax-checked all 6 edited files (`node --check`).
- [x] Committed all 6 and verified each landed (re-staged + checked byte
      counts — all landed cleanly, no forced retries needed this time).

**Still needed (cannot do from this session — no delete access on the
user's machine):**
- [ ] Delete these files/directories:
      - `public/super_admin/people/access-control.html`
      - `public/js/super_admin/people/access-control.js`
      - `routes/super_admin/people/access-control.js`
      - `controllers/super_admin/people/access-control/` (whole directory)
      - `models/super_admin/people/access-control/` (whole directory)
- [ ] Run `database/seeders/017_menu_items.js` and
      `database/seeders/010_header_page_configs.js` directly (or
      `npm run db:seed`, which runs all seeders) to actually remove the
      live `menu_items`/`role_menu_permissions`/`header_page_configs` rows
      — the seeder file edits above only affect a fresh install/reseed
      until these are run.
- [ ] After that DB cleanup runs, the sidebar won't reflect it until
      `MenuModel`'s in-memory per-role cache is cleared (`MenuModel.
      clearAllCache()`) or the app process is restarted — a plain
      page-refresh won't be enough on its own.
- [ ] Run `npm run structure:update` (or `.\generate_structure.ps1`) after
      the file deletions above, per project convention.

## Fix Manage Rubrics page (broken ID naming + missing fields) (2026-09-16)

**Request:** update `/super_admin/people/manage-rubrics` "according to what
we currently have in logic and in table" — investigated first via
subagent to compare the page's HTML/JS/controller/model against the real
`rubric_categories`/`rubric_indicators` DB schema and the canonical
weight-based scoring path (`services/engine/audit_scoring.py`'s
`compute_weighted_overall`, confirmed already fixed in an earlier TODO
entry this session).

**Findings:**
- The category "Weight" field IS correctly wired to the real canonical
  column (`rubric_categories.weight`, the same column
  `compute_weighted_overall` consumes) — no scoring-logic bug here.
- **Real bug found**: the page's own "ID" concept was broken end-to-end.
  The DB columns are `category_code`/`indicator_code`, but the page's
  HTML/JS read/wrote a property called `category_id`/`indicator_id` that
  never existed on the returned rows (`MasterRubricModel.getCategories()`/
  `getIndicators()` never aliased it). Effects: the "ID" column always
  showed blank, the category dropdown in the Indicator modal always had
  `value=""` for every option (making it impossible to actually assign a
  category to a new/edited indicator through the UI), and Edit/Delete on
  every row silently no-op'd (`.find()` against `undefined` always failed).
- `ManageRubricsModel.updateCategory()`/`updateIndicator()` also silently
  dropped several real, already-supported columns on update (only
  `create` forwarded most of them) — `category_code`/`indicator_code`
  itself, plus `subgroup_name`, `benchmark`, `requires_video`,
  `requires_calculation`, `calculation_config` for indicators.
- The Indicator modal never exposed `subgroup_name`, `benchmark`,
  `requires_video`, `requires_calculation`, or `calculation_config` at
  all — all real, actively-used columns (the last two specifically drive
  the Python engine's config-driven scoring in `rubric_loader.py`/
  `audit_scoring.py`).
- Seeders (`006_rubric.js`, `020_admin_rubric.js`) already match the live
  schema correctly — no seeder mismatch. Noted (cosmetic, not a bug):
  seeded category weights are fractional (0–1, summing to 1.0), but the
  page's Weight input had no `max` and a `%` suffix on display, which
  could mislead an admin into entering e.g. "22" instead of "0.22".

**Fixes:**
- [x] `public/super_admin/people/manage-rubrics.html` — renamed the
      Category/Indicator "ID" input fields to `category_code`/
      `indicator_code` (matching the real columns); added Subgroup,
      Benchmark, Requires Video, Requires Calculation, and a
      Calculation Config (JSON) field (shown only when Requires
      Calculation is checked) to the Indicator modal; clarified the
      Weight field's scale (0–1, step 0.01, max 1) to match the seeded
      convention.
- [x] `public/js/super_admin/people/manage-rubrics.js` — fixed every
      reference from the non-existent `category_id`/`indicator_id` to
      the real `category_code`/`indicator_code` (table columns, Actions
      buttons, `editCategory`/`editIndicator` lookups, the category
      dropdown's value/selected-matching in `openIndicatorModal`/
      `editIndicator`); removed the misleading `%` from the Weight
      column display; wired the 5 new indicator fields into
      `editIndicator()` (populate) and the submit handler (payload),
      including JSON-parsing/validating `calculation_config` before
      submit and a show/hide toggle for that field.
- [x] `models/super_admin/people/manage-rubrics/ManageRubricsModel.js` —
      `updateCategory()` now forwards `category_code` (with a
      `category_id` fallback for compatibility); `updateIndicator()` now
      forwards `indicator_code` plus `subgroup_name`/`benchmark`/
      `requires_video`/`requires_calculation`/`calculation_config`, all
      previously silently dropped; `createIndicator()` now also forwards
      `requires_calculation`/`calculation_config` (previously missing
      even from create).
- [x] `controllers/super_admin/people/manage-rubrics/manageRubricsController.js`
      — `createCategory`/`createIndicator` now destructure and forward
      `category_code`/`indicator_code` and the new indicator fields from
      the request body (still no SQL/business logic in the controller).
      `updateCategory`/`updateIndicator` already passed the full
      `req.body` through, so no change needed there.
- [x] Confirmed no changes needed to `models/super_admin/rubrics/
      MasterRubricModel.js` — it already fully supports every real
      column and already accepts either the numeric `id` or the
      `category_code`/`indicator_code` string as an identifier
      (`_categoryByIdentifier`/`_indicatorByIdentifier`), so routing the
      page's Edit/Delete/dropdown values through the code strings works
      correctly with zero backend changes there.
- [x] Syntax-checked all 4 changed files; grepped for leftover stale
      `category_id`/`indicator_id` references in the HTML/JS to confirm
      no strays.
- [x] Committed all 4 files and verified each landed (re-staged +
      checked byte counts — all landed cleanly, no forced retries
      needed).

**Not touched / out of scope:** `routes/rubrics.js` +
`controllers/rubrics/masterRubricController.js` +
`models/rubrics/MasterRubricModel.js` are a separate, near-duplicate
legacy path (`/api/rubrics/*`, unrelated to this Super Admin page) —
flagged by the investigation as a standing "duplicate canonical
implementation" issue, but left alone since it wasn't part of what was
asked and touching it is a separate, larger decision.

## Fix slow PUT /api/super_admin/sidebar-menu-management/permissions (2026-09-16)

**Problem:** Saving role menu permissions from
http://www.localretentionlab.com/super_admin/settings/sidebar-menu-management
was reported as taking too much time.

**Root cause:** `models/menu/MenuModel.js#saveRoleMenuPermissions(roleId, permissions)`
did a single efficient bulk `DELETE FROM role_menu_permissions WHERE role_id = ?`,
but then inserted the new rows with a `for...of` loop doing one `await runAsync(...)`
per menu item — i.e. one sequential network round trip to MySQL per row (typically
30-80 items per role) instead of a single bulk statement. Verified indexes on
`role_menu_permissions` (`idx_role`, `idx_menu_item`, `idx_parent`, unique
`(role_id, menu_item_id)`) were already correct and not the bottleneck.

- [x] Confirm the actual route/controller/model chain for this endpoint
      (`routes/super_admin/sidebar-menu-management.js` -> `PUT /permissions`
      -> `controllers/super_admin/menu/menuController.js#updateMenuPermissions`
      -> `MenuModel.saveRoleMenuPermissions`).
- [x] Confirm indexes on `role_menu_permissions` (migration
      `028_create_role_menu_permissions_table.js`) are correct and not the cause.
- [x] Replace the per-row `INSERT` loop in `saveRoleMenuPermissions` with a
      single bulk multi-row `INSERT ... VALUES (?,?,?,?,?), (?,?,?,?,?), ...`
      built from one flattened params array, passed through the existing
      `runAsync` helper unchanged. Guarded for the empty-`permissions` case
      (skip the insert entirely rather than issuing an invalid empty-VALUES
      statement). Left the existing bulk `DELETE` and `invalidateCache(roleId)`
      call unchanged.
- [x] `node --check` on the edited file.
- [x] Commit to `C:\xampp\htdocs\RetentionLab\models\menu\MenuModel.js` and
      verify the write landed (re-staged, byte count matched, grep confirmed
      the new bulk-insert code) — no revert this time, single commit succeeded.
- [ ] User to verify in-browser that saving permissions on the Sidebar Menu
      Management page is now fast, and that permissions still save/apply
      correctly (visibility, sort order, nesting) for at least one role.

## Sidebar Menu Management page: fix broken Parent Item / data-integrity bug (2026-09-16)

**Problem (found while reviewing the page for a data-correctness pass):** The
Edit modal on
http://www.localretentionlab.com/super_admin/settings/sidebar-menu-management
has a full "Parent Item" `<select>` (`#modalParentId`) that was never wired
up — `public/js/super_admin/settings/sidebar-menu-management.js` never
populated its options, never read its selected value, and never sent it to
the save endpoint. Worse, every save (single-item hide/edit, and the
"Reset to defaults" reseed) sent a `permissions` array with **no `parent_id`
field at all**, so `MenuModel.saveRoleMenuPermissions` (via `perm.parent_id
|| null`) wrote `NULL` into `role_menu_permissions.parent_id` for every row
on every save — silently discarding any role-specific menu hierarchy on each
save (currently masked in the UI because `buildMenuTree()` falls back to the
global `menu_items.parent_id` default when the per-role value is null, so it
wasn't visibly broken, but the per-role override column was effectively
dead).

- [x] Wire up `#modalParentId`: `editMenuItem()` now populates it with every
      other menu item for the role (excluding the item itself and its
      descendants, to prevent hierarchy cycles) and preselects the item's
      current parent.
- [x] `saveModalForm()` now reads the selected parent and includes
      `parent_id` for **every** item in the saved `permissions` array
      (preserving each item's existing parent, changing only the edited
      item's), instead of omitting the field entirely.
- [x] `deleteMenuItemById()` (the "Hide" action) now also includes each
      item's current `parent_id` in its save payload, for the same reason.
- [x] `controllers/super_admin/menu/menuController.js#reseedRoleMenuPermissions`
      now includes `parent_id: item.parent_id` (the default from
      `menu_items`) in the permissions it reseeds, so "Reset to defaults"
      explicitly restores the default hierarchy instead of omitting the
      field.
- [x] Made the Menu ID / Label / Icon / Link URL fields in the Edit modal
      read-only with a visual disabled style — these come from the shared
      `menu_items` table (used by every role) and were never actually saved
      by this page (only visibility, sort order, and now parent, which are
      per-role `role_menu_permissions` columns, are saved); the fields were
      previously editable-looking but any typed change was silently
      discarded, which is misleading.
- [x] `node --check` on both edited files.
- [x] Committed both files, verified with re-stage + byte-count match (no
      revert).
- [ ] User to verify in-browser: editing a role's menu item, changing its
      Parent Item, and saving actually re-parents it in the Tree View; and
      that Menu ID/Label/Icon/Href now show as read-only in the modal.

## Speed up GET-side POST /api/super_admin/sidebar-menu-management/permissions (2026-09-16)

**Problem:** After the bulk-insert fix to the PUT (save) side, the page's
read/list call — `POST /api/super_admin/sidebar-menu-management/permissions`
(`controllers/super_admin/menu/menuController.js#getMenuPermissions`) — was
still reported as slow. This endpoint only reads data (no writes), so the
fix here is read-path only.

**Root cause:** in both branches of `getMenuPermissions` (`user_id` and
`role_id`), the two required queries — `MenuModel.getAllMenuItems(roleId)`
and `MenuModel.getRoleMenuPermissions(roleId)` — were awaited **sequentially**
(one full DB round trip, then another), even though they don't depend on
each other. `MenuModel.getResolvedMenuForUser` (used by the real sidebar
render path) already runs the same two queries with `Promise.all`, so this
controller wasn't following that existing pattern.

- [x] Confirmed `middleware/auth.js` (`requireAuth`/`requireRole`) does no
      DB work — pure JWT verification — so it isn't part of the slowness.
- [x] Confirmed `menu_items` (migration `026_create_menu_items_table.js`)
      already has indexes on `is_active`, `role_id`, and `parent_id`, and
      `database/db.js`'s MySQL pool config (`connectionLimit: 10`,
      `waitForConnections: true`) is unremarkable — not the bottleneck.
- [x] Changed both branches of `getMenuPermissions` (`role_id`, the one this
      page actually calls, and `user_id`) to fetch `menuItems` and
      `rolePermissions` with `Promise.all` instead of two sequential
      `await`s — one DB round trip's worth of latency removed per call.
      Did not touch `updateMenuPermissions` (PUT/save) or
      `saveRoleMenuPermissions` — out of scope per this request (read-only).
- [x] `node --check` passed; committed and verified byte-for-byte (landed
      on the first commit, no revert).
- [ ] User to verify in-browser that switching roles / loading the
      permissions list on the Sidebar Menu Management page is now
      noticeably faster.

## Collapse permissions read to a single joined DB query (2026-09-16)

**Follow-up to the previous entry.** User asked how many DB hits the read
endpoint made and what the better approach would be. Answer: 2 (menu items,
role permissions), already running in parallel via `Promise.all`. Better
approach: don't fetch them separately at all — do the merge in SQL with a
`LEFT JOIN` so it's 1 round trip instead of 2, and MySQL (not a JS
`Array.map` + object lookup) does the matching.

- [x] Added `MenuModel.getMenuItemsWithPermissions(roleId)` —
      `SELECT ... FROM menu_items mi LEFT JOIN role_menu_permissions rmp
      ON rmp.menu_item_id = mi.id AND rmp.role_id = ? WHERE mi.is_active = 1
      AND mi.role_id = ?` — one query, one round trip. Preserved the exact
      same `parent_id` resolution rule `getRoleMenuPermissions` had (a
      `role_menu_permissions.parent_id` can reference another
      `role_menu_permissions.id` instead of a `menu_item_id` directly; the
      row-id -> menu_item_id map is now built from this same joined result
      set instead of a separate query).
- [x] Updated both branches (`role_id`, `user_id`) of
      `getMenuPermissions` in `controllers/super_admin/menu/menuController.js`
      to call the new single-query method instead of
      `Promise.all([getAllMenuItems, getRoleMenuPermissions])`, and confirmed
      the shape/values returned to the frontend are unchanged (same
      `is_visible`/`sort_order`/`parent_id` fallback behavior when a role has
      no explicit permission row for an item yet).
- [x] Left `getAllMenuItems` and `getRoleMenuPermissions` themselves
      untouched — they're still used by `getResolvedMenuForUser` (the real
      sidebar render path) and `reseedRoleMenuPermissions`, which weren't
      part of this request.
- [x] `node --check` on both files; committed and verified byte-for-byte
      (both landed on the first try, no revert).
- [ ] User to verify in-browser that the Sidebar Menu Management page still
      loads the correct permissions per role after this change (visibility,
      sort order, parent nesting all still correct) and is faster/equal.

## Rebuild Sidebar Menu Management page: one display, one action (2026-09-16)

**Request:** user reported the page was still "loading" slow/confusing, and
asked for a full rebuild (HTML -> JS -> Routes -> Controller -> Model) with
a single display of the role's menu items and exactly one action:
enable/disable (show/hide) visibility — freeing me to redesign it.

**Approach taken:** the backend (routes, controller, model) from the
previous two entries was already correct and already down to a single
joined DB query for reads and a single bulk statement for writes, so no
backend changes were needed here — the actual problem was the frontend UX:
the old page rendered the SAME data twice (a Tree View AND a duplicate Flat
Table below it) and offered a modal with 5 fields (Menu ID, Label, Parent,
Icon, Link URL) that mostly did nothing when saved (only visibility/order/
parent were ever persisted — see the entry above about the unwired Parent
dropdown). That duplication and the misleading modal were very likely what
read as "still not working right."

- [x] Removed the duplicate Flat Table view entirely — one Tree View is now
      the only display of the role's menu items.
- [x] Removed the Edit modal entirely (Menu ID / Label / Parent / Icon /
      Link URL / Display Order fields) — none of those are meant to be
      edited from this page (they're seeder-owned, shared across roles).
- [x] Replaced the old "Edit" + "Hide" per-row buttons with ONE action per
      row: a visibility toggle switch. This is the single approach the user
      asked for.
- [x] Toggling is local/in-memory (no request per click); an explicit "Save
      Changes" button commits the whole role's permission set once, and an
      "Unsaved changes" indicator plus a beforeunload warning protect
      against losing untoggled changes. "Reset to Defaults" replaces the old
      per-page reseed button, unchanged in behavior.
- [x] Kept `parent_id` and `sort_order` exactly as loaded (per-item, not
      user-editable in this simplified view) when building the save
      payload, so the parent-hierarchy fix from two entries up is preserved.
- [x] Routes (`routes/super_admin/sidebar-menu-management.js`), controller
      (`getMenuPermissions`, `updateMenuPermissions`,
      `reseedRoleMenuPermissions`) and model
      (`MenuModel.getMenuItemsWithPermissions`,
      `saveRoleMenuPermissions`) were reviewed and left unchanged — already
      correct and already optimized (1 query to read, 1 bulk statement to
      write) from the prior two fixes.
- [x] `node --check` on the rewritten JS; committed both files, verified
      byte-for-byte (landed on the first try, no revert).
- [ ] User to load the page in-browser, pick a role, confirm the tree
      renders once (no duplicate table), toggle a couple of items, Save,
      reload and confirm the change persisted, then try Reset to Defaults.

## Sidebar Menu Management: change the actual data-fetching approach, not just the UI (2026-09-16)

**Request:** user pointed out the previous rebuild only touched the
frontend — routes, controller and model were still the same POST-with-body
endpoint returning a flat list, with the frontend re-deriving the tree
itself. Asked for a real change to "how to get data," across every layer.

**New approach (routes -> controller -> model, HTML/JS updated to match):**

- [x] `routes/super_admin/sidebar-menu-management.js`: the read endpoint is
      now `GET /permissions?role_id=` instead of `POST /permissions` with
      `{ role_id }` in the body — it never writes anything, so the HTTP
      verb should say so.
- [x] `models/menu/MenuModel.js`:
      - Added `getRoleMenuTree(roleId)` — calls the existing single joined
        query (`getMenuItemsWithPermissions`) and returns the role's FULL
        menu already nested into a tree, INCLUDING hidden items (each node
        carries its own `is_visible`), unlike `buildMenuTree`/
        `getResolvedMenuForUser` which only build the sidebar's
        visible-only tree.
      - Extracted the nest-by-parent-id + sort-by-order logic that
        `buildMenuTree` already had into a shared `_nestByParentId(nodes)`
        helper, and had `buildMenuTree` call it — so `getRoleMenuTree`
        reuses the exact same nesting rule instead of a second, duplicate
        implementation (per this project's "extend the canonical function"
        rule).
- [x] `controllers/super_admin/menu/menuController.js`: `getMenuPermissions`
      now reads `role_id`/`user_id` from `req.query` (not `req.body`) and
      returns `MenuModel.getRoleMenuTree(...)` directly — the response
      `data` is now a nested tree, not a flat array the frontend has to
      re-nest.
- [x] `public/js/super_admin/settings/sidebar-menu-management.js`:
      - Fetches with `GET .../permissions?role_id=X` instead of `POST`
        with a JSON body.
      - Renders the tree the server returns directly — no more scanning
        the full flat item list for every node's children
        (`currentFlatItems.filter(...)` per row, which was effectively
        O(n²) for a role with many items).
      - Builds a flat `nodeById` map once per load so toggling a switch is
        an O(1) lookup instead of an `Array.find()` over every item.
      - Added `flattenTree()` to turn the tree back into the flat
        `{ menu_item_id, is_visible, sort_order, parent_id }[]` shape the
        PUT /permissions save endpoint expects (that endpoint's shape was
        left unchanged, as saving wasn't part of this "get data" request).
- [x] `node --check` on all 4 changed files; committed and verified
      byte-for-byte — all four landed on the first try, no revert.
- [ ] User to verify in-browser: role dropdown loads the tree via the new
      GET endpoint (check Network tab shows GET, not POST, for
      `.../permissions`), toggles still work, Save still persists
      correctly, and Reset to Defaults still works.
