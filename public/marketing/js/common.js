// Vortex Innovations - Common Layout and Navigation Logic

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inject Header (Navbar) and Footer Content
  injectHeader();
  injectFooter();

  // 2. Initialize Lucide Icons
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // 3. Attach common handlers to window for navigation and mobile drawer
  window.toggleMobileMenu = () => {
    const drawer = document.getElementById("mobile-menu");
    const icon = document.getElementById("hamburger-icon");
    if (!drawer) return;

    if (drawer.classList.contains("hidden")) {
      drawer.classList.remove("hidden");
      if (icon) icon.setAttribute("data-lucide", "x");
    } else {
      drawer.classList.add("hidden");
      if (icon) icon.setAttribute("data-lucide", "menu");
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  };

  window.handleFooterSubscribe = (event) => {
    event.preventDefault();
    const emailInput = document.getElementById("newsletter-email");
    const container = document.getElementById("footer-newsletter-container");
    if (!emailInput || !container) return;

    const email = emailInput.value.trim();
    if (!email) return;

    // Show beautiful static success message
    container.innerHTML = `
      <div class="bg-emerald-950/45 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn">
        <i data-lucide="check-circle" class="w-4 h-4 shrink-0 text-emerald-400 mt-0.5"></i>
        <div>
          <p class="font-bold">Subscribed Successfully!</p>
          <p class="text-slate-400 mt-0.5">Thank you for joining Vortex Weekly Insights. We will deliver the latest technology trends to you.</p>
        </div>
      </div>
    `;
    if (typeof lucide !== "undefined") lucide.createIcons();
  };
});

function getActivePageName() {
  const path = window.location.pathname;
  if (path.includes("about.html")) return "about";
  if (path.includes("services.html")) return "services";
  if (path.includes("blog.html")) return "blog";
  if (path.includes("faq.html")) return "faq";
  if (path.includes("contact.html")) return "contact";
  if (path.includes("privacy.html")) return "privacy";
  if (path.includes("terms.html")) return "terms";
  return "home"; // default
}

function injectHeader() {
  const nav = document.getElementById("vortex-nav");
  if (!nav) return;

  const activePage = getActivePageName();
  const navItems = [
    { label: "Home", file: "/", id: "home" },
    { label: "About Us", file: "about", id: "about" },
    { label: "Services", file: "services", id: "services" },
    { label: "Blog", file: "blog", id: "blog" },
    { label: "FAQ", file: "faq", id: "faq" },
    { label: "Contact Us", file: "contact", id: "contact" }
  ];

  const desktopLinksHtml = navItems.map(item => {
    const isActive = activePage === item.id;
    const classes = isActive
      ? "px-4 py-2 rounded-xl text-sm transition-all duration-200 text-white bg-indigo-500/15 border-indigo-500/20 border font-semibold"
      : "px-4 py-2 rounded-xl text-sm transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-900/40";
    return `<a href="${item.file}" class="${classes}">${item.label}</a>`;
  }).join('');

  const mobileLinksHtml = navItems.map(item => {
    const isActive = activePage === item.id;
    const classes = isActive
      ? "w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-semibold bg-indigo-600/25 text-white"
      : "w-full py-3 px-4 rounded-xl text-left text-sm transition-all font-medium text-slate-400 hover:text-white hover:bg-slate-900/80";
    return `<a href="${item.file}" class="${classes}">${item.label}</a>`;
  }).join('') + `
    <a href="/contact" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-center text-xs tracking-wide py-3 px-5 rounded-xl transition-colors mt-2 uppercase flex items-center justify-center gap-1.5 cursor-pointer">
      <span>Get in Touch</span>
      <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
    </a>
  `;

  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="flex items-center justify-between">
        
        <!-- Logo -->
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

        <!-- Desktop nav links -->
        <div class="hidden lg:flex items-center gap-1.5 font-medium">
          ${desktopLinksHtml}
        </div>

        <!-- Contact CTA -->
        <div class="hidden lg:flex items-center gap-4">
          <a href="/contact" class="bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/20 cursor-pointer font-semibold text-xs tracking-wide py-2.5 px-5 rounded-xl text-white transition-all duration-200 uppercase flex items-center gap-1.5 border border-indigo-500/40 decoration-none">
            <span>Get in Touch</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </a>
        </div>

        <!-- Mobile hamburger -->
        <button onclick="toggleMobileMenu()" class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none transition-all cursor-pointer" aria-label="Toggle Navigation Menu">
          <i data-lucide="menu" id="hamburger-icon" class="w-6 h-6"></i>
        </button>

      </div>
    </div>

    <!-- Mobile Drawer -->
    <div id="mobile-menu" class="hidden lg:hidden absolute top-full inset-x-0 bg-[#090d16]/95 backdrop-blur-lg border-b border-slate-800 shadow-2xl py-6 px-4 flex flex-col gap-3.5 animate-fadeIn">
      ${mobileLinksHtml}
    </div>
  `;
}

function injectFooter() {
  const footer = document.getElementById("global-footer");
  if (!footer) return;

  footer.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 md:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 mb-16">
        
        <!-- Brand (Col 4) -->
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
          <div class="flex items-center gap-3">
            <a href="https://linkedin.com" target="_blank" class="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-800">
              <i data-lucide="linkedin" class="w-4 h-4"></i>
            </a>
            <a href="https://twitter.com" target="_blank" class="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-800">
              <i data-lucide="twitter" class="w-4 h-4"></i>
            </a>
            <a href="https://facebook.com" target="_blank" class="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-800">
              <i data-lucide="facebook" class="w-4 h-4"></i>
            </a>
            <a href="https://github.com" target="_blank" class="w-8.5 h-8.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-slate-800">
              <i data-lucide="github" class="w-4 h-4"></i>
            </a>
          </div>
        </div>

        <!-- Information (Col 2) -->
        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Information</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="/index" class="text-slate-400 hover:text-white transition-colors decoration-none block">Overview</a></li>
            <li><a href="/about" class="text-slate-400 hover:text-white transition-colors decoration-none block">Company Story</a></li>
            <li><a href="/services" class="text-slate-400 hover:text-white transition-colors decoration-none block">Our Services</a></li>
            <li><a href="/blog" class="text-slate-400 hover:text-white transition-colors decoration-none block">Insights & Articles</a></li>
          </ul>
        </div>

        <!-- Support Workspace (Col 2) -->
        <div class="lg:col-span-2 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Support Workspace</h4>
          <ul class="space-y-2.5 text-sm font-medium list-none p-0">
            <li><a href="/faq" class="text-slate-400 hover:text-white transition-colors decoration-none block">FAQ Accordion</a></li>
            <li><a href="/contact" class="text-slate-400 hover:text-white transition-colors decoration-none block">Contact Us</a></li>
            <li><a href="/privacy" class="text-slate-400 hover:text-white transition-colors decoration-none block">Privacy Policy</a></li>
            <li><a href="/terms" class="text-slate-400 hover:text-white transition-colors decoration-none block">Terms of Service</a></li>
          </ul>
        </div>

        <!-- Newsletter (Col 4) -->
        <div class="lg:col-span-4 space-y-4">
          <h4 class="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">Weekly Tech Insights</h4>
          <p class="text-sm text-slate-400 font-normal">
            Get detailed updates on cutting-edge software paradigms, performance growth techniques, and security practices sent straight to your inbox.
          </p>
          
          <div id="footer-newsletter-container">
            <form onsubmit="handleFooterSubscribe(event)" class="flex gap-2">
              <div class="relative flex-grow">
                <i data-lucide="mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"></i>
                <input required type="email" id="newsletter-email" placeholder="Enter your email address" class="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white rounded-xl py-2 pl-9.5 pr-3 text-xs outline-none transition-all placeholder:text-slate-600">
              </div>
              <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl cursor-pointer transition-all active:translate-y-0.5" aria-label="Subscribe">
                <i data-lucide="send" class="w-4 h-4"></i>
              </button>
            </form>
          </div>
        </div>

      </div>

      <!-- Lower Foot -->
      <div class="border-t border-slate-900/60 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <p class="text-slate-500">
          &copy; 2026 Vortex Innovations Inc. Developed for cloud scale architecture under premium constraints.
        </p>
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
