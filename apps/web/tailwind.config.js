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
      // Colors resolve through CSS variables (RGB channels) defined in index.css,
      // so flipping the `.dark` class on <html> re-themes every text-ink/bg-paper/…
      // utility with no markup changes. The `<alpha-value>` form keeps opacity
      // modifiers (e.g. bg-ink/40, text-ink/85) working.
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        'paper-deep': 'rgb(var(--color-paper-deep) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        rule: 'rgb(var(--color-rule) / <alpha-value>)',
        vermilion: 'rgb(var(--color-vermilion) / <alpha-value>)',
        'vermilion-deep': 'rgb(var(--color-vermilion-deep) / <alpha-value>)',
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
