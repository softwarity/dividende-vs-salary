/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        accent: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.06), 0 1px 3px 1px rgba(0,0,0,0.10)',
        'card-hover': '0 2px 4px 0 rgba(0,0,0,0.08), 0 4px 8px 3px rgba(0,0,0,0.12)',
        appbar: '0 2px 4px -1px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
