/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        allianz: {
          blue: '#003781',
          light: '#0066CC',
          gray: '#F5F7FA',
        },
        corporate: {
          ink: '#172033',
          muted: '#667085',
          surface: '#F7F9FC',
          line: '#DDE3EA',
          navy: '#071B3A',
        },
      },
    },
  },
  plugins: [],
}
