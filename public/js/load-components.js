/**
 * root/public/js/load-components.js
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Load shared sidebar template (role-aware)
  const shouldLoadSidebar = !document.getElementById('sidebarNav');
  if (shouldLoadSidebar) {
    try {
      // Always use the common sidebar for all roles
      const sidebarPath = '/sidebar.html';
      const res = await fetch(sidebarPath);
      const sidebarHtml = await res.text();
      const sidebarDiv = document.createElement('div');
      sidebarDiv.innerHTML = sidebarHtml;
      const aside = sidebarDiv.firstElementChild;
      // Insert into sidebar-placeholder if it exists, otherwise prepend to body
      const placeholder = document.getElementById('sidebar-placeholder');
      if (placeholder) {
        placeholder.parentNode.replaceChild(aside, placeholder);
      } else {
        document.body.insertBefore(aside, document.body.firstChild);
      }
      executeScripts(sidebarDiv);
    } catch (err) {
      console.error('Failed to load shared sidebar:', err);
    }
  }

  // Load shared header template
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (headerPlaceholder) {
    try {
      const res = await fetch('/header.html');
      headerPlaceholder.innerHTML = await res.text();
      executeScripts(headerPlaceholder);
    } catch (err) {
      console.error('Failed to load shared header:', err);
    }
  }

  // Load Common Footer
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    try {
      const res = await fetch('/common_footer.html');
      footerPlaceholder.innerHTML = await res.text();
      executeScripts(footerPlaceholder);
    } catch (err) {
      console.error('Failed to load common footer:', err);
    }
  }

  let resolveHeaderReady;
  const rlHeaderReady = new Promise((resolve) => { resolveHeaderReady = resolve; });
  globalThis.__rlHeaderReady = rlHeaderReady;

  function executeScripts(element) {
    element.querySelectorAll('script').forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  // ── Initialize dynamic header + sidebar controllers ─────────────────────────
  const initKeyController = '__rl_header_controller_init__';
  const initKeyRoleCommon = '__rl_header_role_common_init__';
  const initKeySidebar    = '__rl_sidebar_controller_init__';

  const waitFor = async (predicate, timeoutMs = 3000, intervalMs = 50) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  };

  if (headerPlaceholder) {
    await waitFor(() => !!document.getElementById('profileMenuWrap'), 3000);

    // header.js handles header config, controller, and profile/role common
    // fetches /api/header-config/me, populates title/description/nav links,
    // wires profile dropdown + logout.
    if (!globalThis[initKeyController]) {
      globalThis[initKeyController] = true;
      try {
        const headerMod = await import('/js/header.js');
        if (typeof headerMod?.init === 'function') {
          await headerMod.init();
        }
      } catch (err) {
        console.error('Failed to load header.js:', err);
      }
    }

    // Sidebar controller
    if (!globalThis[initKeySidebar]) {
      globalThis[initKeySidebar] = true;
      // Wait for sidebar to be loaded before initializing controller
      await waitFor(() => !!document.getElementById('sidebarMenuList'), 3000);
      try {
        const sidebarMod = await import('/js/sidebar/sidebar.js');
        if (typeof sidebarMod?.init === 'function') {
          await sidebarMod.init();
        } else if (typeof globalThis.populateSidebar === 'function') {
          await globalThis.populateSidebar();
        }
      } catch (err) {
        console.error('Failed to initialize sidebar.js:', err);
      }
    }

    resolveHeaderReady?.();
  } else {
    resolveHeaderReady?.();
  }
});