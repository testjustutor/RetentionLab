# TODO

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
