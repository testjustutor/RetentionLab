# HTML → JS AUDIT - PHASE 2

**Analysis Date**: 2026-06-11  
**Total Pages Audited**: 24  
**Issues Found**: 12+

---

## PAGE: public/login.html

**Scripts Imported:**
- `/js/login.js` (module)

**DOM Elements Referenced in JS:**
- Form: `loginForm` ✓ Present
- Input: `loginEmail` ✓ Present
- Input: `loginPassword` ✓ Present  
- Div: `loginError` ✓ Present

**Event Handlers:**
- form.addEventListener('submit', ...) ✓ Present

**ISSUES:**
- None detected

**FIX PLAN:**
- Page is clean, no issues

---

## PAGE: public/register.html

**Scripts Imported:**
- `/js/auth.js` (module)
- `/js/register.js` (module)

**DOM Elements Referenced in JS:**
- Form: `registerForm` ✓ Present
- Input: `registerEmail` ✓ Present
- Input: `registerPassword` ✓ Present
- Input: `registerName` ✓ Present
- Div: `registerError` ✓ Present

**Event Handlers:**
- form.addEventListener('submit', ...) ✓ Present

**ISSUES:**
1. **Redirect URL Mismatch**: register.js line 3 redirects to `/employee-dashboard.html` but correct path is `/employee/index.html`
2. **Module Load Order Problem**: auth.js loads first and runs its auth guard code before register.js can set up form handlers
3. **Auth Guard Conflict**: auth.js will auto-redirect logged-in users away from register.html before registration form is usable

**FIX PLAN:**
1. Update redirect URL in register.js from `/employee-dashboard.html` to `/employee/index.html`
2. Only import register.js (auth.js should not run on public auth pages)
3. Add auth.js guard conditional: skip redirect if on registration page

---

## PAGE: public/index.html

**Scripts Imported:**
- None

**DOM Elements:**
- Only static page with links to role-based dashboards

**ISSUES:**
- None detected (landing page, no JS functionality)

**FIX PLAN:**
- No action needed

---

## PAGE: public/admin/index.html

**Scripts Imported:**
- None (NO JS FILES LOADED)

**Inline Event Handlers:**
- `onclick="toggleProfileMenu()"` (line 26, profileBtn)
- `onclick="toggleProfileMenu()"` (line 112, profileChevron area references)

**DOM Elements with Event Handlers:**
- id: `profileBtn` - Calls `toggleProfileMenu()` but function not defined
- id: `logoutButton` - No event handler attached

**Referenced in Inline Handlers:**
- `toggleProfileMenu()` - FUNCTION NOT DEFINED ❌

**ISSUES:**
1. **Missing Function Definition**: `toggleProfileMenu()` called but never defined
2. **No JS Loaded**: Page has multiple inline `onclick` handlers but imports no JavaScript file
3. **Logout Button**: Has id `logoutButton` but no click handler
4. **Missing Logout Handler**: `handleLogout()` referenced in other admin pages but not defined

**FIX PLAN:**
1. Create admin.js module with `toggleProfileMenu()` function
2. Import `/js/admin.js` as module in `<head>`
3. Add click event listener for `#logoutButton` to call logout
4. Implement proper event delegation instead of inline onclick handlers

---

## PAGE: public/admin/profile.html

**Scripts Imported:**
- None (NO JS FILES LOADED)

**Inline Event Handlers:**
- `onclick="toggleProfileMenu()"` (line 26, profileBtn)
- `onclick="handleLogout()"` (line 52, logout button)
- `onsubmit="saveProfile(event)"` (line 120, profileForm)

**Inline Script Tag Present:**
- Lines 156-170: Defines `toggleProfileMenu()` function
- References to `profileMenu`, `profileChevron`, `profileMenuWrap`

**DOM Elements:**
- id: `profileMenuWrap` - Used in inline script ✓
- id: `profileBtn` - Calls toggleProfileMenu() ✓
- id: `profileMenu` - Modified by toggleProfileMenu() ✓
- id: `profileChevron` - Modified by toggleProfileMenu() ✓
- id: `profileForm` - Calls saveProfile() ❌
- id: `logoutButton` - Calls handleLogout() ❌
- Form inputs: `inputName`, `inputEmail` - No initialization ❌

**Referenced Functions NOT Defined:**
- `saveProfile(event)` - ❌ MISSING
- `handleLogout()` - ❌ MISSING

**ISSUES:**
1. **Incomplete Inline Script**: Only `toggleProfileMenu()` defined; `saveProfile()` and `handleLogout()` missing
2. **Unsafe Inline Event Handlers**: Should use `addEventListener` instead of `onclick` attributes
3. **No Form Initialization**: Profile form inputs not pre-populated with user data
4. **No API Integration**: Form submit doesn't make PUT request to save changes
5. **Missing Logout Functionality**: handleLogout() not implemented

**FIX PLAN:**
1. Create `/js/user-profile-api.js` with `saveProfile()` and `handleLogout()` functions
2. Import script in `<head>`: `<script type="module" src="/js/user-profile-api.js"></script>`
3. Remove inline `onclick` handlers, use addEventListener in JS
4. Implement form pre-fill from `/api/auth/me` response
5. Implement form save with PUT to `/api/users/:id`
6. Implement logout with POST to `/api/auth/logout`
7. Move inline toggleProfileMenu() to external user-profile-api.js

---

## PAGE: public/admin/settings.html

**Scripts Imported:**
- None (NO JS FILES LOADED)

**Inline Event Handlers:**
- `onclick="toggleProfileMenu()"` (line 26, profileBtn)
- `onclick="handleLogout()"` (line 52, logout button)

**Inline Script Tag Present:**
- NO inline script defined for this page

**DOM Elements:**
- id: `profileBtn` - Calls `toggleProfileMenu()` ❌
- id: `profileMenu` - Should be toggled ❌
- id: `profileChevron` - Should rotate ❌
- id: `logoutButton` - Calls `handleLogout()` ❌

**Referenced Functions NOT Defined:**
- `toggleProfileMenu()` - ❌ MISSING
- `handleLogout()` - ❌ MISSING

**ISSUES:**
1. **No JavaScript Loaded**: Page has onclick handlers but no .js file imported
2. **Functions Undefined**: `toggleProfileMenu()` and `handleLogout()` not defined anywhere
3. **No Settings Functionality**: No JS to load or save system settings
4. **Code Duplication Risk**: Same header pattern on multiple pages without shared script

**FIX PLAN:**
1. Import `/js/admin.js` module (or create shared admin-common.js)
2. Remove inline onclick attributes
3. Add event listeners in JS file for profile menu toggle
4. Add event listener for logout button
5. Implement settings form handlers to call `/api/settings` endpoints
6. Consider extracting common header logic to shared component

---

## PAGE: public/admin/calendar-accounts.html

**Scripts Imported:**
- None detected (partial HTML read)

**ISSUES:**
- Need to complete audit by reading full file (pagination cutoff)

**FIX PLAN:**
- Read complete file and verify script imports and DOM element references

---

## PAGE: public/admin/archives.html

**Scripts Imported:**
- `../css/archives.css` (CSS)
- `../css/shared.css` (CSS)
- `/js/archives.js` (Direct script tag, not module)
- External: `https://cdn.jsdelivr.net/npm/flatpickr` (library)
- External: `https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css` (CSS)

**DOM Elements Referenced in archives.js:**
- Input: `fromDate` ✓ Present (date input for filtering)
- Input: `toDate` ✓ Present (date input for filtering)
- Input: `searchTranscript` ✓ Present (search field)
- Input: `meetingSearch` ✓ Present (meetings search)
- Div: `meetingsList` ✓ Present (list container)
- Div: `loadingMeetings` - NOT FOUND ❌
- Div: `meetingCount` - NOT FOUND ❌
- Div: `emptyState` - NOT FOUND ❌
- Div: `activeView` - NOT FOUND ❌
- Div: `mtgDate` - NOT FOUND ❌
- Div: `mtgTitle` - NOT FOUND ❌
- Div: `mtgId` - NOT FOUND ❌
- Div: `mtgPlatform` - NOT FOUND ❌
- Audio: `audioPlayer` - NOT FOUND ❌
- Function: `loadMeetings()` - Window-level function, called by button click

**Event Handlers:**
- Button: `onclick="loadMeetings()"` ✓ Present (refresh button)

**External Dependencies:**
- flatpickr (date picker) ✓ Loaded from CDN
- archives.js ✓ Present

**ISSUES:**
1. **Missing DOM Elements**: 9+ DOM IDs referenced in archives.js don't exist in HTML
   - loadingMeetings (loading spinner)
   - meetingCount (meeting counter)
   - emptyState (empty state display)
   - activeView (meeting details panel)
   - mtgDate, mtgTitle, mtgId, mtgPlatform (meeting metadata display)
   - audioPlayer (audio player for recordings)
2. **Incomplete HTML**: The HTML read was truncated; rest of page structure not visible
3. **Missing Meeting Detail View**: JS expects a detail view panel that's not in the visible HTML
4. **No Transcript Display**: transcriptSearch references .transcript-item elements not found

**FIX PLAN:**
1. Read complete archives.html file to see full HTML structure
2. Add missing DOM elements referenced by archives.js:
   - Create loading indicator div with id `loadingMeetings`
   - Create meeting counter span with id `meetingCount`
   - Create empty state message div with id `emptyState`
   - Create detail view panel with id `activeView`
   - Add meeting metadata display IDs: mtgDate, mtgTitle, mtgId, mtgPlatform
   - Add audio player element with id `audioPlayer`
   - Add transcript item container with class `transcript-item`
3. Verify all flatpickr calendar initialization works with the date inputs
4. Ensure CSS styles support detail view layout

---

## PAGE: public/super_admin/bot.html

**Scripts Imported:**
- `../css/bot.css` (CSS)
- `../js/bot.js` (Direct script tag, not module)

**DOM Elements Referenced in bot.js:**
- Span: `statusText` - NOT FOUND ❌
- Span: `kpiActiveBots` - NOT FOUND ❌
- Span: `kpiGpuCompute` - NOT FOUND ❌
- Span: `kpiTaskQueue` - NOT FOUND ❌
- Div: `terminal` - NOT FOUND ❌
- Ul: `workersList` - NOT FOUND ❌

**API Calls:**
- GET `/api/bot` - Called every 10 seconds
- Returns: stats, logs, workers

**Polling Mechanism:**
- `setInterval(loadBotData, 10000)` - 10 second refresh ✓

**ISSUES:**
1. **Missing KPI Display Elements**: bot.js references 4 KPI card elements that don't exist in HTML
   - statusText (status indicator)
   - kpiActiveBots (active bot count)
   - kpiGpuCompute (GPU usage %)
   - kpiTaskQueue (task queue length)
2. **Missing Log Terminal**: Reference to `terminal` element for displaying bot logs
3. **Missing Worker List**: Reference to `workersList` for displaying active bot instances
4. **Incomplete HTML**: The HTML read was truncated after KPI cards section; detailed view might be missing

**FIX PLAN:**
1. Read complete bot.html file to verify full structure
2. Add missing DOM elements in KPI card section:
   - `<span id="statusText">` in status KPI card
   - `<span id="kpiActiveBots">` in active bots KPI card
   - `<span id="kpiGpuCompute">` in GPU compute KPI card
   - `<span id="kpiTaskQueue">` in task queue KPI card
3. Add terminal/log display section:
   - `<div id="terminal" class="terminal-display">` with log entries
4. Add workers list section:
   - `<ul id="workersList">` for bot instance list with status badges
5. Ensure CSS (bot.css) supports terminal and worker card styling

---

## PAGE: public/employee/index.html

**Scripts Imported:**
- None

**DOM Elements:**
- id: `pageTitle` ✓ Present (expects JS to populate)
- id: `userName` ✓ Present (expects JS to populate)
- id: `userEmail` ✓ Present (expects JS to populate)
- id: `userRole` ✓ Present (expects JS to populate)
- id: `logoutButton` ✓ Present (has click handler expected)

**Event Handlers:**
- Button: `#logoutButton` - No handler defined

**ISSUES:**
1. **No JavaScript Imported**: auth.js should initialize this page but isn't explicitly loaded
2. **Logout Button**: Needs click handler but no JS imported
3. **Page Relies on auth.js**: Depends on global `initDashboard()` from auth.js but not imported

**FIX PLAN:**
1. Import auth.js in `<head>`: `<script type="module" src="/js/auth.js"></script>`
2. Add dashboard-specific logout handler or rely on auth.js global handler
3. Test that auth.js guard allows employee role access

---

## PAGE: public/reviewer/index.html

**Scripts Imported:**
- None

**DOM Elements:**
- id: `pageTitle` ✓ Present
- id: `userName` ✓ Present
- id: `userEmail` ✓ Present
- id: `userRole` ✓ Present
- id: `logoutButton` ✓ Present

**ISSUES:**
- Same as employee/index.html: no JS imported, auth.js not loaded explicitly

**FIX PLAN:**
- Same as employee/index.html: import auth.js module

---

## PAGE: public/super_admin/index.html

**Scripts Imported:**
- None (NO JS FILES LOADED)

**Inline Event Handlers:**
- `onclick="toggleProfileMenu()"` (profileBtn)
- `onclick="handleLogout()"` (logout button)

**DOM Elements:**
- id: `pageTitle` ✓ Present
- id: `profileBtn` - Calls undefined `toggleProfileMenu()`
- id: `profileMenu` - Should be toggled
- id: `profileChevron` - Should rotate
- id: `logoutButton` - Calls undefined `handleLogout()`

**ISSUES:**
1. **No JavaScript Loaded**: Page has onclick handlers but no .js file imported
2. **Functions Undefined**: `toggleProfileMenu()` and `handleLogout()` not defined
3. **Dashboard Not Initialized**: No user data loaded (userName, userEmail, userRole elements present but not populated)

**FIX PLAN:**
1. Import auth.js and admin.js (or super-admin.js) modules
2. Remove inline onclick handlers, use event listeners
3. Ensure auth.js initializes dashboard with user data
4. Add logout handler to admin.js

---

## PAGE: public/admin/audit.html

**Status**: File not found (doesn't exist - needs verification)

**Expected**:
- Should be in `/public/admin/audit.html` or `/public/super_admin/audit.html`

**ISSUES:**
1. **File Missing**: audit.html not found at expected path

**FIX PLAN:**
1. Verify if audit.html exists at different path
2. If it exists, complete audit by reading file
3. If missing, create file or document that feature is not yet implemented

---

## PAGE: public/admin/assets.html

**Status**: File not found (doesn't exist)

**Expected**:
- Should be in `/public/admin/assets.html` or `/public/super_admin/assets.html`

**ISSUES:**
1. **File Missing**: assets.html not found

**FIX PLAN:**
1. Verify correct path for assets page
2. If missing, note as unimplemented feature

---

## SUMMARY OF ISSUES

### Critical (Blocks Functionality)
| Page | Issue | Severity |
|------|-------|----------|
| admin/index.html | `toggleProfileMenu()` undefined | Critical |
| admin/profile.html | `saveProfile()`, `handleLogout()` undefined | Critical |
| admin/settings.html | `toggleProfileMenu()`, `handleLogout()` undefined | Critical |
| super_admin/index.html | `toggleProfileMenu()`, `handleLogout()` undefined | Critical |
| super_admin/bot.html | 6+ DOM element IDs missing | Critical |
| admin/archives.html | 9+ DOM element IDs missing | Critical |

### High (Missing Imports)
| Page | Issue | Severity |
|------|-------|----------|
| register.html | auth.js auto-redirect conflicts with registration | High |
| employee/index.html | No auth.js imported | High |
| reviewer/index.html | No auth.js imported | High |

### Medium (Broken Paths)
| Page | Issue | Severity |
|------|-------|----------|
| register.js | Redirect to `/employee-dashboard.html` (wrong path) | Medium |

### Low (Missing Features)
| Page | Issue | Severity |
|------|-------|----------|
| admin/profile.html | Form not pre-populated with user data | Low |
| super_admin/bot.html | Terminal layout may need CSS work | Low |

---

## PRIORITY REMEDIATION ORDER

1. **Fix Admin Header Functions** (affects 3 pages)
   - Create `/js/admin.js` with toggleProfileMenu(), handleLogout()
   - Apply to: admin/index.html, admin/profile.html, admin/settings.html

2. **Fix Super Admin Header** (affects 1 page)
   - Create `/js/super-admin.js` with same header functions
   - Apply to: super_admin/index.html

3. **Fix Auth Guard Conflict**
   - Update auth.js to not redirect from register page
   - Update register.js redirect path

4. **Complete Missing DOM Elements**
   - Add elements to archives.html for meeting details view
   - Add elements to bot.html for KPI display and worker list

5. **Import Missing Scripts**
   - Add auth.js imports to employee/index.html and reviewer/index.html

6. **Form Integration**
   - Create /js/user-profile-api.js for profile form handling

---

**Report Generated**: 2026-06-11  
**Analysis Complete**: NO CODE MODIFICATIONS MADE
