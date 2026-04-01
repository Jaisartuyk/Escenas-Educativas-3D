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
        bg:      '#06050f',
        bg2:     '#0e0c1e',
        bg3:     '#13112a',
        surface: '#1a1730',
        surface2:'#221e3e',
        violet:  '#7c6dfa',
        violet2: '#a99bff',
        rose:    '#f06292',
        teal:    '#26d7b4',
        amber:   '#ffb347',
        ink:     '#f0eeff',
        ink2:    '#b8b0d8',
        ink3:    '#7a72a0',
      },
      borderColor: {
        DEFAULT: 'rgba(120,100,255,0.14)',
      },
    },
  },
  plugins: [],
}

export default config
