/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#0c0d12',
          sidebar: '#111319',
          card: '#161922',
          cardHover: '#1d212d',
          cardLight: '#ffffff',
          cardHoverLight: '#f8fafc',
          border: '#232836',
          borderLight: '#e2e8f0',
          textMuted: '#858d9d',
        },
        pastel: {
          amber: '#fed7aa',
          amberDark: '#f59e0b',
          amberText: '#78350f',
          purple: '#c4b5fd',
          purpleDark: '#8b5cf6',
          purpleText: '#4c1d95',
          lime: '#bef264',
          limeDark: '#84cc16',
          limeText: '#365314',
          coral: '#fca5a5',
          coralText: '#7f1d1d',
        },
        music: {
          dark: {
            bg: '#0c0d12',
            surface: '#111319',
            card: '#161922',
            border: '#232836',
            hover: '#1d212d'
          },
          light: {
            bg: '#f4f5f8',
            surface: '#ffffff',
            card: '#ffffff',
            border: '#e2e8f0',
            hover: '#f1f5f9'
          },
          accent: {
            DEFAULT: '#3b82f6',
            hover: '#2563eb',
            gold: '#f59e0b'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        music: ['Bravura', 'Leland', 'Gonville', 'serif']
      }
    },
  },
  plugins: [],
}
