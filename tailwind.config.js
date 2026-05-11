/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          ink: '#2f211f',
          muted: '#7d625d',
          paper: '#fff7f3',
          line: '#f0d6ce',
          coral: '#f25f4c',
          coralDark: '#c93f35',
          coralSoft: '#ffe1d8',
          yellow: '#d99a1e',
          red: '#d33a2c',
          green: '#168a58'
        }
      },
      boxShadow: {
        soft: '0 12px 34px rgba(129, 54, 42, 0.12)',
        note: '0 8px 22px rgba(129, 54, 42, 0.10)'
      }
    }
  },
  plugins: []
};