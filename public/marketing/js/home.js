/**
 * public/marketing/js/home.js
 */

let activeTestimonialIndex = 0;
let testimonialInterval = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  try {
    renderMetrics();
    renderFeatures();
    renderServices();
    renderPricing();
    renderTestimonial();
    renderFAQ();
    initializeLucideIcons();
    startTestimonialAutoPlay();
    setupScrollAnimations();
  } catch (error) {
    console.error('Homepage initialization error:', error);
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
    try {
      lucide.createIcons();
    } catch (error) {
      console.warn('Lucide icons initialization failed:', error);
    }
  }
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML-safe text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup scroll animations for elements
 */
function setupScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fadeInUp');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all cards and sections
  document.querySelectorAll('.card, .pricing-card, .faq-item').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// ==========================================
// METRICS SECTION
// ==========================================

/**
 * Render the metrics grid with key achievements
 * Data source: window.ACHIEVEMENTS
 */
function renderMetrics() {
  const grid = document.getElementById("metrics-grid");
  if (!grid || !window.ACHIEVEMENTS) return;

  grid.innerHTML = window.ACHIEVEMENTS.map(item => `
    <div class="metric-item">
      <span class="metric-number">${item.number}</span>
      <span class="metric-label">${item.label}</span>
      <span class="metric-description">${item.description}</span>
    </div>
  `).join('');
}

// ==========================================
// FEATURES SECTION
// ==========================================

/**
 * Render the features grid
 * Data source: window.FEATURES
 */
function renderFeatures() {
  const grid = document.getElementById("features-grid");
  if (!grid || !window.FEATURES) return;

  grid.innerHTML = window.FEATURES.map(feature => `
    <div class="card">
      <div class="card-icon">
        <i data-lucide="${feature.icon}"></i>
      </div>
      <h3 class="card-title">${feature.title}</h3>
      <p class="card-description">${feature.description}</p>
    </div>
  `).join('');

  initializeLucideIcons();
}

// ==========================================
// SERVICES SECTION
// ==========================================

/**
 * Render the services/capabilities grid
 * Data source: window.SERVICES
 */
function renderServices() {
  const grid = document.getElementById("services-grid");
  if (!grid || !window.SERVICES) return;

  grid.innerHTML = window.SERVICES.map(service => `
    <div class="card">
      <div class="card-icon">
        <i data-lucide="${service.icon}"></i>
      </div>
      <h3 class="card-title">${service.title}</h3>
      <p class="card-description">${service.description}</p>
      <div class="mt-4 pt-4 border-t border-[#30363d] flex items-center justify-between">
        <span class="text-xs font-mono font-semibold text-[#ff6b35] uppercase">${service.category}</span>
        <span class="text-xs text-[#8b949e]">${service.priceRange}</span>
      </div>
    </div>
  `).join('');

  initializeLucideIcons();
}

// ==========================================
// PRICING SECTION
// ==========================================

/**
 * Render the pricing plans
 * Data source: window.PLANS
 */
function renderPricing() {
  const grid = document.getElementById("pricing-grid");
  if (!grid || !window.PLANS) return;

  grid.innerHTML = window.PLANS.map(plan => `
    <div class="pricing-card ${plan.highlighted ? 'pricing-card-featured' : ''}">
      ${plan.highlighted ? '<div class="pricing-badge">Most Popular</div>' : ''}
      
      <div class="text-center mb-6">
        <h3 class="text-xl font-bold text-[#f0f6fc]">${plan.name}</h3>
        <p class="text-sm text-[#c9d1d9] mt-2">${plan.description}</p>
      </div>

      <div class="text-center mb-6">
        <span class="text-4xl font-extrabold text-[#f0f6fc]">${plan.price}</span>
        <span class="text-lg text-[#8b949e]">${plan.period}</span>
      </div>

      <ul class="pricing-features">
        ${plan.features.map(feature => `
          <li>
            <i data-lucide="check" class="w-5 h-5 text-[#3fb950]"></i>
            <span>${feature}</span>
          </li>
        `).join('')}
      </ul>

      <a href="/register" class="btn w-full ${plan.highlighted ? 'btn-primary' : 'btn-secondary'}">
        ${plan.cta}
      </a>
    </div>
  `).join('');

  initializeLucideIcons();
}

// ==========================================
// TESTIMONIALS SECTION
// ==========================================

/**
 * Render the current testimonial
 * Data source: window.TESTIMONIALS
 */
function renderTestimonial() {
  if (!window.TESTIMONIALS || window.TESTIMONIALS.length === 0) return;

  const data = window.TESTIMONIALS[activeTestimonialIndex];
  
  // Update testimonial content
  const quoteEl = document.getElementById("testimonial-quote");
  if (quoteEl) quoteEl.innerHTML = `&ldquo;${data.quote}&rdquo;`;

  const authorEl = document.getElementById("testimonial-author");
  if (authorEl) authorEl.textContent = data.author;

  const roleEl = document.getElementById("testimonial-role");
  if (roleEl) roleEl.textContent = data.role;

  // Update avatar
  const avatarImg = document.getElementById("testimonial-avatar");
  if (avatarImg) {
    avatarImg.src = data.avatar;
    avatarImg.alt = data.author;
  }

  // Update star rating
  const starRating = document.getElementById("rating-stars");
  if (starRating) {
    starRating.innerHTML = Array(5).fill(0).map(() => `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fill-amber-500 text-amber-500">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    `).join('');
  }

  // Update index counter
  const indexEl = document.getElementById("testimonial-index");
  if (indexEl) {
    indexEl.textContent = `${activeTestimonialIndex + 1} / ${window.TESTIMONIALS.length}`;
  }

  initializeLucideIcons();
}

/**
 * Navigate to the next or previous testimonial
 * @param {number} direction - Direction to navigate (-1 for previous, 1 for next)
 */
window.slideTestimonial = function(direction) {
  const len = window.TESTIMONIALS.length;
  activeTestimonialIndex = (activeTestimonialIndex + direction + len) % len;
  renderTestimonial();
  resetTestimonialAutoPlay();
};

/**
 * Start automatic testimonial rotation
 */
function startTestimonialAutoPlay() {
  if (window.TESTIMONIALS && window.TESTIMONIALS.length > 1) {
    testimonialInterval = setInterval(() => {
      window.slideTestimonial(1);
    }, 5000);
  }
}

/**
 * Reset the auto-play timer after manual navigation
 */
function resetTestimonialAutoPlay() {
  if (testimonialInterval) {
    clearInterval(testimonialInterval);
  }
  startTestimonialAutoPlay();
}

// ==========================================
// FAQ SECTION
// ==========================================

/**
 * Render the FAQ accordion
 * Data source: window.FAQS
 */
function renderFAQ() {
  const container = document.getElementById("faq-container");
  if (!container || !window.FAQS) return;

  container.innerHTML = window.FAQS.map((faq, index) => `
    <div class="faq-item">
      <button 
        onclick="toggleFAQ(${index})" 
        class="faq-question"
        aria-expanded="false"
        aria-controls="faq-answer-${index}"
      >
        <span>${escapeHtml(faq.question)}</span>
        <svg data-lucide="chevron-down" class="w-5 h-5 transition-transform duration-200" id="faq-icon-${index}"></svg>
      </button>
      <div id="faq-answer-${index}" class="faq-answer hidden">
        <p>${escapeHtml(faq.answer)}</p>
      </div>
    </div>
  `).join('');

  initializeLucideIcons();
}

/**
 * Toggle FAQ accordion item
 * @param {number} index - Index of the FAQ item to toggle
 */
window.toggleFAQ = function(index) {
  const answer = document.getElementById(`faq-answer-${index}`);
  const icon = document.getElementById(`faq-icon-${index}`);
  const button = answer?.previousElementSibling;
  
  if (!answer) return;

  const isOpen = !answer.classList.contains('hidden');

  // Close all other FAQs
  document.querySelectorAll('.faq-answer').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.faq-question svg').forEach(el => el.style.transform = '');
  document.querySelectorAll('.faq-question').forEach(el => el.setAttribute('aria-expanded', 'false'));

  // Open this FAQ if it was closed
  if (!isOpen) {
    answer.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
    if (button) button.setAttribute('aria-expanded', 'true');
  }

  initializeLucideIcons();
};

// ==========================================
// EXPORTS FOR TESTING
// ==========================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderMetrics,
    renderFeatures,
    renderServices,
    renderPricing,
    renderTestimonial,
    renderFAQ,
    slideTestimonial: window.slideTestimonial,
    toggleFAQ: window.toggleFAQ
  };
}