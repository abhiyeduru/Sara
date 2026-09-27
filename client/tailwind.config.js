/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand — violet/purple accent
        violet: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        sara: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e1e26',
          850: '#16161d',
          900: '#0f0f14',
          950: '#060608',
        },
        // Neutral grays for the white theme
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          150: '#edf1f7',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Surface/bg
        surface: {
          DEFAULT: '#ffffff',
          soft:    '#f7f7f9',
          muted:   '#f1f1f5',
          border:  '#e8e8f0',
        },
        // Status
        success: '#16a34a',
        warning: '#ea580c',
        danger:  '#dc2626',
        info:    '#0284c7',
      },
      fontFamily: {
        sans:     ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display:  ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono:     ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':      '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover':'0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'dropdown':  '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'modal':     '0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08)',
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out',
        'slide-up':      'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left': 'slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'shimmer':       'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeIn:      { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:     { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInLeft: { from: { opacity: 0, transform: 'translateX(-8px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        bounceSubtle:{ '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        shimmer:     { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
