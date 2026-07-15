/**
 * root/public/js/page-metadata.js
*/
/**
 * page-metadata.js
 *
 * Reads standardized page metadata from <meta> tags.
 *
 * Contract (per page HTML):
 *  <meta name="dashboard-role" content="super_admin">
 *  <meta name="dashboard-page" content="dashboard">
 *
 * Output:
 *  { roleKey: string|null, pageId: string }
 */

function getMeta(name) {
  return document.querySelector(`meta[name="${name}"]`);
}

export function readPageMetadata() {
  const roleMeta = getMeta('dashboard-role');
  const pageMeta = getMeta('dashboard-page');

  const roleKey = roleMeta?.getAttribute('content')?.trim() || null;
  const pageId = pageMeta?.getAttribute('content')?.trim() || 'dashboard';

  return { roleKey, pageId };
}

