import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-bricolage)', 'sans-serif'],
        body:    ['var(--font-instrument)', 'sans-serif'],
      },
      colors: {
        bg:      '#F8FAFC', // Slate 50
        bg2:     '#FFFFFF', // White
        bg3:     '#F1F5F9', // Slate 100
        surface: '#FFFFFF',
        surface2:'#F8FAFC',
        violet:  '#4F46E5', // Indigo 600
        violet2: '#6366F1', // Indigo 500
        rose:    '#F43F5E', // Rose 500
        teal:    '#10B981', // Emerald 500
        amber:   '#F59E0B', // Amber 500
        ink:     '#0F172A', // Slate 900
        ink2:    '#334155', // Slate 700
        ink3:    '#64748B', // Slate 500
        ink4:    '#94A3B8', // Slate 400
      },
      borderColor: {
        DEFAULT: 'rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
