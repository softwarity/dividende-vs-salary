/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'sans-serif',
        ],
      },
      colors: {
        // Bleu softwarity (type GitHub dark)
        primary: {
          50: '#e6f0ff',
          100: '#cce0ff',
          200: '#a3c8ff',
          300: '#79c0ff',
          400: '#58a6ff',
          500: '#388bfd',
          600: '#1f6feb',
          700: '#1158c7',
          800: '#0d419d',
          900: '#0c2d6b',
        },
        // Vert softwarity (positif / dividende / économie)
        accent: {
          50: '#e6ffec',
          100: '#aff5b4',
          200: '#6fdd8b',
          300: '#56d364',
          400: '#3fb950',
          500: '#2ea043',
          600: '#238636',
          700: '#1a7f37',
          800: '#116329',
          900: '#033a16',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.4)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.5)',
        appbar: '0 2px 8px -1px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
