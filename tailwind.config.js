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
        music: {
          dark: {
            bg: '#0f1117',
            surface: '#171a23',
            card: '#1f2432',
            border: '#2c3345',
            hover: '#262c3d'
          },
          light: {
            bg: '#f8fafc',
            surface: '#ffffff',
            card: '#f1f5f9',
            border: '#e2e8f0',
            hover: '#e2e8f0'
          },
          accent: {
            DEFAULT: '#2563eb',
            hover: '#1d4ed8',
            gold: '#d97706'
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
