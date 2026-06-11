/**
 * root/public/js/load-components.js
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Load shared sidebar template
  const shouldLoadSidebar = !document.getElementById('sidebarNav');
  if (shouldLoadSidebar) {
    try {
      const res = await fetch('/sidebar.html');
      const sidebarHtml = await res.text();
      const sidebarDiv = document.createElement('div');
      sidebarDiv.innerHTML = sidebarHtml;
      document.body.insertBefore(sidebarDiv.firstElementChild, document.body.firstChild);
      executeScripts(sidebarDiv);
    } catch (err) {
      console.error('Failed to load shared sidebar:', err);
    }
  }

  // Load sidebar styles
  if (!document.querySelector('link[href="/css/sidebar.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/sidebar.css';
    document.head.appendChild(link);
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

    // header-controller.js self-initializes on import:
    // fetches /api/header-config/me, populates title/description/nav links,
    // wires profile dropdown + logout.
    if (!globalThis[initKeyController]) {
      globalThis[initKeyController] = true;
      try {
        await import('/js/header-controller.js');
      } catch (err) {
        console.error('Failed to load header-controller:', err);

        // If header-controller fails to load, still initialize profile
        // dropdown/rendering and logout from role-common so profile buttons
        // remain clickable.
        try {
          const roleMod = await import('/js/header-role-common.js');
          if (typeof roleMod?.initProfileRoleHeaderCommon === 'function') {
            await roleMod.initProfileRoleHeaderCommon();
          }
          if (typeof roleMod?.initDropdownBehavior === 'function') {
            roleMod.initDropdownBehavior();
          }
          if (typeof roleMod?.initLogout === 'function') {
            roleMod.initLogout();
          }
        } catch (fallbackErr) {
          console.error('Failed to recover header controls after header-controller load failure:', fallbackErr);
        }
      }
    }

    // header-role-common.js handles ONLY profile rendering now
    // (avatar/name/email/userName/userEmail via user-profile-api.js).
    // Its dropdown/logout init is redundant with header-controller.js,
    // but harmless since it checks for missing markup before binding —
    // however, since both bind click listeners to the SAME elements,
    // this WILL double-fire toggle/logout. We call only the profile-render
    // part by relying on initProfileRoleHeaderCommon's internal guard
    // (initialized flag) — but since it ALSO binds dropdown/logout,
    // recommend trimming header-role-common.js to remove
    // initDropdownBehavior() + initLogout() calls inside
    // initProfileRoleHeaderCommon(), since header-controller.js owns those now.
    if (!globalThis[initKeyRoleCommon]) {
      globalThis[initKeyRoleCommon] = true;
      try {
        const roleMod = await import('/js/header-role-common.js');
        if (typeof roleMod?.initProfileRoleHeaderCommon === 'function') {
          await roleMod.initProfileRoleHeaderCommon();
        } else if (typeof globalThis.initProfileRoleHeaderCommon === 'function') {
          await globalThis.initProfileRoleHeaderCommon();
        }
      } catch (err) {
        try {
          if (typeof globalThis.initProfileRoleHeaderCommon === 'function') {
            await globalThis.initProfileRoleHeaderCommon();
          }
        } catch (_) {
          console.error('Failed to initialize header-role-common:', err);
        }
      }
    }

    // Sidebar controller
    if (!globalThis[initKeySidebar]) {
      globalThis[initKeySidebar] = true;
      try {
        const sidebarMod = await import('/js/sidebar-controller.js');
        if (typeof sidebarMod?.init === 'function') {
          await sidebarMod.init();
        }
      } catch (err) {
        console.error('Failed to initialize sidebar-controller:', err);
      }
    }

    resolveHeaderReady?.();
  } else {
    resolveHeaderReady?.();
  }
});