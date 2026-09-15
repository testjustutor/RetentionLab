/**
 * public/css/tailwind-config.js
 */

tailwind.config = {
  theme: {
    extend: {
      colors: {
        // Use CSS variables for all colors
        'slate': {
          '50': 'var(--color-bg-tertiary, #faf8f3)',
          '100': 'var(--color-bg-hover, #f5f1e8)',
          '200': 'var(--color-border, #e2e8f0)',
          '300': 'var(--color-text-muted, #64748b)',
          '400': 'var(--color-text-muted, #64748b)',
          '500': 'var(--color-text-muted, #64748b)',
          '600': 'var(--color-text-secondary, #334155)',
          '700': 'var(--color-border-dark, #1e293b)',
          '800': 'var(--color-border-dark, #1e293b)',
          '850': 'var(--color-border-darker, #0f172a)',
          '900': 'var(--color-bg-tertiary, #faf8f3)',
          '950': 'var(--color-bg-secondary, #f8fafc)',
        },
        'white': '#ffffff',
        'gold': {
          '400': 'var(--color-accent-hover, #1f65c2)',
          '500': 'var(--color-accent-primary, #1f65c2)',
          '600': 'var(--color-accent-active, #16448d)',
        },
        'amber': {
          '400': 'var(--color-accent-hover, #1f65c2)',
          '500': 'var(--color-accent-primary, #1f65c2)',
          '600': 'var(--color-accent-active, #16448d)',
        },
        'emerald': {
          '400': 'var(--color-success, #10b981)',
          '500': 'var(--color-success, #10b981)',
        },
        'red': {
          '400': 'var(--color-danger-hover, #dc2626)',
          '500': 'var(--color-danger, #ef4444)',
        },
      }
    }
  }
}