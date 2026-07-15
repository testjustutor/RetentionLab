# TODO - Super Admin folder + routing re-structure

- [x] Inventory all current `public/super_admin/*.html` files and determine which module each belongs to.
- [x] Inventory all current `public/js/super_admin/*.js` files (including bundles) and map each to its module.

- [ ] Create new folder structure under:
  - [ ] `public/super_admin/<module>/...` for all pages
  - [ ] `public/js/super_admin/<module>/...` for all JS
- [ ] Update every moved HTML file:
  - [ ] Fix `<script src>` paths to new JS locations
  - [ ] Fix any internal links like `/super_admin/*.html` to new clean URLs
- [ ] Update routing:
  - [ ] Modify `routes/pages.js` to support `/super_admin/:section/:page` -> `public/super_admin/:section/:page.html`
  - [ ] Keep `/super_admin` and `/super_admin/:page?` working (redirect or fallback)
- [ ] Remove/replace old root-level super admin HTML files so pages all live in folders.
- [ ] Smoke test important URLs:
  - [ ] `/super_admin/dashboard`
  - [ ] `/super_admin/storage/assets`
  - [ ] `/super_admin/people/add-user`
  - [ ] `/super_admin/roles/roles-access`
  - [ ] `/super_admin/settings/settings`
- [ ] Resolve any 404s / broken script paths found during testing.

