/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme with neon cyan/purple gradients as mentioned in the plan
        primary: '#00FFFF', // Neon Cyan
        secondary: '#800080', // Purple
        background: '#0c0c0c', // Dark background
        surface: '#1a1a1a', // Surface elements
      }
    },
  },
  plugins: [],
}