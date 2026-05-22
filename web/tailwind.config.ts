import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cs-red': '#E50914',
        'cs-dark': '#0a0a1a',
        'cs-surface': '#141428',
        'cs-border': 'rgba(255,255,255,0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(to right, rgba(10,10,26,0.95) 40%, transparent)',
        'gradient-card': 'linear-gradient(to top, rgba(10,10,26,1) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}

export default config
