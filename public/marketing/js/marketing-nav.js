// Marketing shared header + footer injection
// Works for pages inside /public/marketing/*

document.addEventListener('DOMContentLoaded', () => {
  try {
    injectHeader();
    injectFooter();

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } catch (e) {
    // Fail silently to avoid breaking marketing pages
    console.error('marketing-nav.js:', e);
  }
});

function getActivePageName() {
  const path = window.location.pathname || '';
  if (path.includes('about.html')) return 'about';
  if (path.includes('services.html')) return 'services';
  if (path.includes('blog.html')) return 'blog';
  if (path.includes('faq.html')) return 'faq';
  if (path.includes('contact.html')) return 'contact';
  if (path.includes('privacy.html')) return 'privacy';
  if (path.includes('terms.html')) return 'terms';
  return 'home';
}

function injectHeader() {
  const nav = document.getElementById('vortex-nav');
  if (!nav) return;

  const activePage = getActivePageName();

  const navItems = [
    { label: 'Home', file: 'index.html', id: 'home' },
    { label: 'About Us', file: 'about.html', id: 'about' },
    { label: 'Services', file: 'services.html', id: 'services' },
    { label: 'Blog', file: 'blog.html', id: 'blog' },
    { label: 'FAQ', file: 'faq.html', id: 'faq' },
    { label: 'Contact Us', file: 'contact.html', id: 'contact' }
  ];

  const desktopLinksHtml = navItems.map(item => {
    const isActive = activePage === item.id;
    const classes = isActive
      ? 'px-4 py-2 rounded-xl text-sm transition-all duration-200 text-white bg-indigo-500/15 border-indigo-500/20 border font-semibold'
      : 'px-4 py-2 rounded-xl text-sm transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-900/40';

    return `<a href="${item.file}" class="${classes}">${item.label}</a>`;
  }).join('');

  const mobileLinksHtml = navItems.map(item => {
    const isActive = activePage === item.id;
    const classes = isActive
      ? 'w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-semibold bg-indigo-600/25 text-white'
      : 'w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-medium text-slate-400 hover:text-white hover:bg-slate-900/80';

    return `<a href="${item.file}" class="${classes}">${item.label}</a>`;
  }).join('') + `
    <a href="/login" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-center text-xs tracking-wide py-3 px-5 rounded-xl transition-colors mt-2 uppercase flex items-center justify-center gap-1.5 cursor-pointer">
      <span>Get in Touch</span>
      <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
    </a>
  `;

  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="flex items-center justify-between">
        <a href="/index" class="flex items-center gap-2.5 cursor-pointer group select-none decoration-none">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
            <i data-lucide="cpu" class="w-5.5 h-5.5 animate-pulse text-white"></i>
          </div>
          <div>
            <span class="text-lg font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">Vortex</span>
            <span class="text-emerald-400 font-extrabold text-lg ml-0.5">.</span>
            <span class="text-[10px] font-mono block text-slate-500 tracking-wider font-semibold uppercase -mt-1.5">Innovations</span>
          </div>
        </a>

        <div class="hidden lg:flex items-center gap-1.5 font-medium">
          ${desktopLinksHtml}
        </div>

        <div class="hidden lg:flex items-center gap-4">
          <a href="/login" class="bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/20 cursor-pointer font-semibold text-xs tracking-wide py-2.5 px-5 rounded-xl text-white transition-all duration-200 uppercase flex items-center gap-1.5 border border-indigo-500/40 decoration-none">
            <span>Get in Touch</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>

        <button onclick="window.toggleMobileMenu && window.toggleMobileMenu()" class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none transition-all cursor-pointer" aria-label="Toggle Navigation Menu">
          <i data-lucide="menu" id="hamburger-icon" class="w-6 h-6"></i>
        </button>
      </div>
    </div>

    <div id="mobile-menu" class="hidden lg:hidden absolute top-full inset-x-0 bg-[#090d16]/95 backdrop-blur-lg border-b border-slate-800 shadow-2xl py-6 px-4 flex flex-col gap-3.5 animate-fadeIn">
      ${mobileLinksHtml}
    </div>
  `;

  // Define toggle fn once
  if (typeof window.toggleMobileMenu !== 'function') {
    window.toggleMobileMenu = () => {
      const drawer = document.getElementById('mobile-menu');
      const icon = document.getElementById('hamburger-icon');
      if (!drawer) return;

      if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        if (icon) icon.setAttribute('data-lucide', 'x');
      } else {
        drawer.classList.add('hidden');
        if (icon) icon.setAttribute('data-lucide', 'menu');
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
    };
  }
}

function injectFooter() {
  const footer = document.getElementById('global-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">
        <div class="lg:col-span-4 space-y-5">
          <a href="/index" class="flex items-center gap-2.5 cursor-pointer decoration-none">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/10">
              <i data-lucide="flame" class="w-5 h-5 text-white"></i>
            </div>
            <span class="text-lg font-bold tracking-tight text-white">Vortex Innovations</span>
          </a>
          <p class="text-sm leading-relaxed text-slate-400">
            Transforming outdated systems into high-performance web solutions, durable cloud infrastructures, and highly accurate growth funnels.
          </p>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Information</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="/index" class="text-slate-400 hover:text-white transition-colors decoration-none block">Overview</a></li>
            <li><a href="/about" class="text-slate-400 hover:text-white transition-colors decoration-none block">Company Story</a></li>
            <li><a href="/services" class="text-slate-400 hover:text-white transition-colors decoration-none block">Our Services</a></li>
            <li><a href="/blog" class="text-slate-400 hover:text-white transition-colors decoration-none block">Insights & Articles</a></li>
          </ul>
        </div>

        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Support Workspace</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="/faq" class="text-slate-400 hover:text-white transition-colors decoration-none block">FAQ Accordion</a></li>
            <li><a href="/contact" class="text-slate-400 hover:text-white transition-colors decoration-none block">Contact Us</a></li>
            <li><a href="/privacy" class="text-slate-400 hover:text-white transition-colors decoration-none block">Privacy Policy</a></li>
            <li><a href="/terms" class="text-slate-400 hover:text-white transition-colors decoration-none block">Terms of Service</a></li>
          </ul>
        </div>

        <div class="lg:col-span-4 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Weekly Tech Insights</h4>
          <p class="text-sm text-slate-400 font-normal">
            Get detailed updates on cutting-edge software paradigms, performance growth techniques, and security practices sent straight to your inbox.
          </p>
        </div>
      </div>

      <div class="border-t border-slate-900/60 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <p class="text-slate-500">&copy; 2026 Vortex Innovations Inc.</p>
        <div class="flex items-center gap-6">
          <a href="/privacy" class="text-slate-500 hover:text-white transition-colors decoration-none">Privacy</a>
          <a href="/terms" class="text-slate-500 hover:text-white transition-colors decoration-none">Terms</a>
          <button onclick="window.scrollTo({ top: 0, behavior: 'smooth' })" class="w-8 h-8 rounded-lg bg-slate-900/70 hover:bg-slate-850 hover:text-white flex items-center justify-center transition-all border border-slate-800 cursor-pointer" title="Scroll to Top">
            <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

