/**
 * RetentionLab - Marketing Navigation & Footer
 * ===========================================
 * 
 * Dynamic injection of navigation bar and footer with
 * Replit-inspired design and smooth animations.
 * 
 * Features:
 * - Animated logo with gradient
 * - Smooth hover effects
 * - Mobile-responsive hamburger menu
 * - Active page highlighting
 * - CTA buttons for login/register
 */

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  try {
    injectHeader();
    injectFooter();
    initializeLucideIcons();
    setupScrollEffect();
  } catch (error) {
    console.error('Marketing navigation initialization error:', error);
  }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Safely initialize Lucide icons
 */
function initializeLucideIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Get the current page name for active navigation highlighting
 * @returns {string} Current page identifier
 */
function getActivePageName() {
  const path = window.location.pathname || '';
  
  const pageMap = [
    { pattern: 'about', id: 'about' },
    { pattern: 'services', id: 'services' },
    { pattern: 'blog', id: 'blog' },
    { pattern: 'faq', id: 'faq' },
    { pattern: 'contact', id: 'contact' },
    { pattern: 'privacy', id: 'privacy' },
    { pattern: 'terms', id: 'terms' }
  ];

  for (const page of pageMap) {
    if (path.includes(page.pattern)) {
      return page.id;
    }
  }

  return 'home';
}

/**
 * Toggle mobile menu visibility
 */
window.toggleMobileMenu = function() {
  const drawer = document.getElementById('mobile-menu');
  const icon = document.getElementById('hamburger-icon');
  
  if (!drawer) return;

  const isOpen = !drawer.classList.contains('hidden');

  if (isOpen) {
    drawer.classList.add('hidden');
    if (icon) {
      icon.setAttribute('data-lucide', 'menu');
    }
  } else {
    drawer.classList.remove('hidden');
    if (icon) {
      icon.setAttribute('data-lucide', 'x');
    }
  }

  initializeLucideIcons();
};

/**
 * Add scroll effect to navigation
 */
function setupScrollEffect() {
  const nav = document.getElementById('rl-nav');
  if (!nav) return;

  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 50) {
      nav.classList.add('shadow-lg', 'shadow-black/20');
    } else {
      nav.classList.remove('shadow-lg', 'shadow-black/20');
    }

    lastScroll = currentScroll;
  });
}

// ==========================================
// HEADER / NAVIGATION
// ==========================================

/**
 * Inject the navigation header into the page
 */
function injectHeader() {
  const nav = document.getElementById('rl-nav');
  if (!nav) return;

  const activePage = getActivePageName();

  const navItems = [
    { label: 'Home', href: 'index', id: 'home' },
    { label: 'Features', href: '#features', id: 'features' },
    { label: 'Pricing', href: '#pricing', id: 'pricing' },
    { label: 'FAQ', href: '#faq', id: 'faq' },
    { label: 'Contact', href: '#contact', id: 'contact' }
  ];

  const desktopLinks = navItems.map(item => {
    const isActive = activePage === item.id;
    const activeClasses = isActive 
      ? 'px-4 py-2 rounded-xl text-sm transition-all duration-200 text-[#ff8c5a] bg-orange-500/15 border border-orange-500/30 font-semibold'
      : 'px-4 py-2 rounded-xl text-sm transition-all duration-200 text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-orange-500/10';
    
    return `<a href="${item.href}" class="${activeClasses}">${item.label}</a>`;
  }).join('');

  const mobileLinks = navItems.map(item => {
    const isActive = activePage === item.id;
    const activeClasses = isActive
      ? 'w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-semibold bg-orange-500/15 text-[#ff8c5a] border border-orange-500/30'
      : 'w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-medium text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-orange-500/10';
    
    return `<a href="${item.href}" class="${activeClasses}">${item.label}</a>`;
  }).join('');

  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="flex items-center justify-between">
        <!-- Logo -->
        <a href="index" class="flex items-center gap-2.5 cursor-pointer group select-none decoration-none">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff6b35] via-[#ff8555] to-[#3fb950] flex items-center justify-center text-white font-black shadow-lg shadow-orange-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
            <span class="text-base font-extrabold">RL</span>
          </div>
          <div>
            <span class="text-xl font-bold tracking-tight text-[#f0f6fc] group-hover:text-[#ff6b35] transition-colors">Retention</span>
            <span class="text-[#3fb950] font-extrabold text-xl ml-0.5">Lab</span>
          </div>
        </a>

        <!-- Desktop Navigation -->
        <div class="hidden lg:flex items-center gap-1.5 font-medium">
          ${desktopLinks}
        </div>

        <!-- Desktop CTA Buttons -->
        <div class="hidden lg:flex items-center gap-3">
          <a href="/login" class="text-sm text-[#c9d1d9] hover:text-[#f0f6fc] transition-colors font-medium decoration-none hover:scale-105 transition-transform">
            Sign In
          </a>
          <a href="/register" class="bg-[#ff6b35] hover:bg-[#ff8555] hover:shadow-lg hover:shadow-orange-500/30 cursor-pointer font-semibold text-xs tracking-wide py-2.5 px-5 rounded-xl text-white transition-all duration-200 uppercase flex items-center gap-1.5 border border-[#ff6b35] decoration-none hover:scale-105">
            <span>Get Started</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>

        <!-- Mobile Menu Button -->
        <button 
          onclick="window.toggleMobileMenu && window.toggleMobileMenu()" 
          class="lg:hidden p-2 rounded-xl text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-orange-500/10 focus:outline-none transition-all cursor-pointer hover:scale-110" 
          aria-label="Toggle Navigation Menu"
        >
          <i data-lucide="menu" id="hamburger-icon" class="w-6 h-6"></i>
        </button>
      </div>
    </div>

    <!-- Mobile Menu Dropdown -->
    <div id="mobile-menu" class="hidden lg:hidden absolute top-full inset-x-0 bg-[#0d1117]/98 backdrop-blur-lg border-b border-[#30363d] shadow-2xl py-6 px-4 flex flex-col gap-3.5 animate-fadeIn">
      ${mobileLinks}
      <div class="mt-2 pt-3 border-t border-[#30363d]">
        <a href="/login" class="w-full bg-[#161b22] hover:bg-[#1c2128] text-[#c9d1d9] hover:text-[#f0f6fc] font-semibold text-center text-xs tracking-wide py-3 px-5 rounded-xl transition-colors border border-[#30363d] flex items-center justify-center gap-1.5 cursor-pointer">
          <span>Sign In</span>
          <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
        </a>
        <a href="/register" class="w-full bg-[#ff6b35] hover:bg-[#ff8555] text-white font-semibold text-center text-xs tracking-wide py-3 px-5 rounded-xl transition-colors mt-2 flex items-center justify-center gap-1.5 cursor-pointer">
          <span>Get Started</span>
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    </div>
  `;

  initializeLucideIcons();
}

// ==========================================
// FOOTER
// ==========================================

/**
 * Inject the footer into the page
 */
function injectFooter() {
  const footer = document.getElementById('rl-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
        <!-- Brand Column -->
        <div class="lg:col-span-4 space-y-4">
          <a href="index" class="flex items-center gap-2.5 cursor-pointer decoration-none group">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff6b35] to-[#3fb950] flex items-center justify-center text-white font-bold shadow-md shadow-orange-500/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <span class="text-base font-extrabold">RL</span>
            </div>
            <span class="text-xl font-bold tracking-tight text-[#f0f6fc]">RetentionLab</span>
          </a>
          <p class="text-sm leading-relaxed text-[#c9d1d9]">
            AI-powered meeting intelligence platform. Automatically record, transcribe, summarize, 
            and analyze your meetings with advanced AI insights.
          </p>
          <div class="flex items-center gap-3 pt-2">
            <a href="#" class="w-9 h-9 rounded-lg bg-[#0d1117] hover:bg-orange-500/20 border border-[#30363d] hover:border-[#ff6b35] flex items-center justify-center text-[#c9d1d9] hover:text-[#ff6b35] transition-all hover:scale-110 hover:rotate-12">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2a2 2 0 0 0-2 2v7h-4V8h4v2"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
            <a href="#" class="w-9 h-9 rounded-lg bg-[#0d1117] hover:bg-orange-500/20 border border-[#30363d] hover:border-[#ff6b35] flex items-center justify-center text-[#c9d1d9] hover:text-[#ff6b35] transition-all hover:scale-110 hover:rotate-12">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
            </a>
            <a href="#" class="w-9 h-9 rounded-lg bg-[#0d1117] hover:bg-orange-500/20 border border-[#30363d] hover:border-[#ff6b35] flex items-center justify-center text-[#c9d1d9] hover:text-[#ff6b35] transition-all hover:scale-110 hover:rotate-12">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77A5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.5a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77A5.44 5.44 0 0 0 3.55 8.24c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 17.11V21"/></svg>
            </a>
          </div>
        </div>

        <!-- Product Links -->
        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-[#f0f6fc] uppercase">Product</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="index" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Home</a></li>
            <li><a href="#features" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Features</a></li>
            <li><a href="#pricing" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Pricing</a></li>
            <li><a href="#faq" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">FAQ</a></li>
          </ul>
        </div>

        <!-- Company Links -->
        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-[#f0f6fc] uppercase">Company</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="/about" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">About</a></li>
            <li><a href="/blog" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Blog</a></li>
            <li><a href="/contact" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Contact</a></li>
            <li><a href="/privacy" class="text-[#c9d1d9] hover:text-[#ff6b35] transition-colors decoration-none block hover:translate-x-1 transition-transform">Privacy Policy</a></li>
          </ul>
        </div>

        <!-- CTA Column -->
        <div class="lg:col-span-4 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-[#f0f6fc] uppercase">Get Started</h4>
          <p class="text-sm text-[#c9d1d9] font-normal">
            Ready to transform your meeting management? Start your free trial today — no credit card required.
          </p>
          <a href="/register" class="inline-flex items-center gap-2 bg-[#ff6b35] hover:bg-[#ff8555] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all border border-[#ff6b35] decoration-none hover:scale-105 hover:shadow-lg hover:shadow-orange-500/30">
            <span>Start Free Trial</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      </div>

      <!-- Footer Bottom -->
      <div class="border-t border-[#30363d] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <p class="text-[#8b949e]">&copy; 2026 RetentionLab. All rights reserved.</p>
        <div class="flex items-center gap-6">
          <a href="/privacy" class="text-[#8b949e] hover:text-[#ff6b35] transition-colors decoration-none">Privacy</a>
          <a href="/terms" class="text-[#8b949e] hover:text-[#ff6b35] transition-colors decoration-none">Terms</a>
          <button 
            onclick="window.scrollTo({ top: 0, behavior: 'smooth' })" 
            class="w-8 h-8 rounded-lg bg-[#0d1117] hover:bg-[#1c2128] hover:text-[#ff6b35] flex items-center justify-center transition-all border border-[#30363d] cursor-pointer hover:scale-110 hover:border-[#ff6b35]" 
            title="Scroll to Top"
            aria-label="Scroll to top"
          >
            <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  initializeLucideIcons();
}