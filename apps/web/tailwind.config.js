/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'ui-serif', 'serif'],
        sans: ['"Geist"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        paper: '#F4F1EA',
        'paper-deep': '#ECE6D8',
        ink: '#0E0E0C',
        muted: '#6E665A',
        rule: '#D6CFC1',
        vermilion: '#C9412B',
        'vermilion-deep': '#9F2A19',
      },
      letterSpacing: {
        chip: '0.16em',
        wider2: '0.08em',
      },
      fontSize: {
        chip: ['11px', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
    },
  },
  plugins: [],
};
