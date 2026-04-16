/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Plain CSS var colors (no opacity modifier needed)
        'bg-primary':    'var(--bg-primary)',
        'bg-secondary':  'var(--bg-secondary)',
        'bg-tertiary':   'var(--bg-tertiary)',
        'bg-floating':   'var(--bg-floating)',
        'bg-hover':      'var(--bg-hover)',
        'bg-active':     'var(--bg-active)',
        'bg-modifier':   'var(--bg-modifier)',
        'text-normal':   'var(--text-normal)',
        'text-muted':    'var(--text-muted)',
        'text-link':     '#00A8FC',
        // RGB-channel vars — support opacity modifiers like /20 /60 /30
        'brand':        'rgb(var(--brand-rgb) / <alpha-value>)',
        'brand-hover':  'rgb(var(--brand-hover-rgb) / <alpha-value>)',
        'brand-active': 'rgb(var(--brand-active-rgb) / <alpha-value>)',
        'separator':    'rgb(var(--separator-rgb) / <alpha-value>)',
        // Hardcoded — don't change with theme
        'status-green':  '#23A55A',
        'status-yellow': '#F0B232',
        'status-red':    '#F23F43',
        'channel-default': 'var(--text-muted)',
        'channel-hover':   'var(--text-normal)',
        'channel-active':  'var(--text-normal)',
        'interactive-normal': 'var(--text-muted)',
        'interactive-hover':  'var(--text-normal)',
        'interactive-active': 'var(--text-normal)',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
        'xs':  ['0.75rem',  { lineHeight: '1rem' }],
        'sm':  ['0.875rem', { lineHeight: '1.25rem' }],
        'md':  ['1rem',     { lineHeight: '1.5rem' }],
      },
      borderRadius: {
        'DEFAULT': '4px', 'lg': '8px', 'xl': '16px', 'full': '9999px',
      },
      boxShadow: {
        'elevation-high': '0 8px 16px rgba(0,0,0,0.48)',
        'elevation-low':  '0 1px 0 rgba(4,4,5,0.2), 0 1.5px 0 rgba(6,6,7,0.05), 0 2px 0 rgba(4,4,5,0.05)',
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow':  'spin 2s linear infinite',
        'bounce-in':  'bounceIn 0.3s cubic-bezier(0.68,-0.55,0.27,1.55)',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' },                             to: { opacity: '1' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        bounceIn: { from: { transform: 'scale(0.8)' },                  to: { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
