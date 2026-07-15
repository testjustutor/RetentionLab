// RetentionLab - Tailwind CSS Configuration
// Replit-inspired dark theme with orange accent colors

window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff6b35',
          600: '#ff6b35',
          700: '#ff8555',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407'
        }
      }
    }
  }
};