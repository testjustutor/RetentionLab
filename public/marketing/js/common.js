/**
 * RetentionLab - Common Marketing Utilities
 * ==========================================
 * 
 * Shared utilities used across all marketing pages.
 * 
 * Features:
 * - Lucide icon initialization
 * - Smooth scroll for anchor links
 * - Common UI helpers
 * 
 * Usage:
 * Include this file on any marketing page that needs
 * common functionality.
 */

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize common functionality when DOM is ready
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeLucideIcons();
  setupSmoothScroll();
});

// ==========================================
// ICON MANAGEMENT
// ==========================================

/**
 * Safely initialize Lucide icons
 * Checks if Lucide library is loaded before calling createIcons()
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

// ==========================================
// SMOOTH SCROLL
// ==========================================

/**
 * Setup smooth scrolling for anchor links
 * Intercepts clicks on links starting with # and smoothly
 * scrolls to the target element
 */
function setupSmoothScroll() {
  document.addEventListener('click', (event) => {
    // Find the closest anchor tag
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;

    // Get the target ID from href
    const targetId = link.getAttribute('href');
    if (targetId === '#') return;

    // Find the target element
    const target = document.querySelector(targetId);
    if (!target) return;

    // Prevent default jump behavior
    event.preventDefault();

    // Smooth scroll to target
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to ensure a function is called at most once
 * in a specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if an element is in the viewport
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if element is in viewport
 */
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Add fade-in animation to elements when they scroll into view
 * @param {string} selector - CSS selector for elements to animate
 */
function setupScrollAnimations(selector = '.animate-on-scroll') {
  const elements = document.querySelectorAll(selector);
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fadeIn');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// ==========================================
// EXPORTS FOR TESTING
// ==========================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeLucideIcons,
    setupSmoothScroll,
    debounce,
    throttle,
    isInViewport,
    setupScrollAnimations
  };
}