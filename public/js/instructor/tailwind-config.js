/**
 * public/js/instructor/tailwind-config.js
 */

tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        slate: {
          850: '#141E33',
          900: '#0F172A',
          950: '#020617',
        }
      }
    }
  }
}