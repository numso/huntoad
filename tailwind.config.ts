import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {}
  },
  plugins: [
    // ...
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
} satisfies Config
