/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: '#3b82f6',
          violet: '#8b5cf6',
          dark: '#0f172a',
        }
      },
      spacing: {
        '18': '4.5rem',
      },
      minHeight: {
        'tap': '44px',
      },
      minWidth: {
        'tap': '44px',
      }
    },
  },
  plugins: [],
}
