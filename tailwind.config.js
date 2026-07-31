/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sillar: {
          50: '#F7F5F1',
          100: '#EFEBE2',
          200: '#DDD6C9',
        },
        salvia: {
          400: '#6B8F71',
          600: '#3F6B47',
          800: '#264A2C',
        },
        tierra: {
          400: '#C97A2B',
          500: '#B0651C',
          600: '#8F5116',
        },
        tinta: '#1F2A2E',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
