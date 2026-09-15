/**
 * public/js/sidebar/page-metadata.js
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
