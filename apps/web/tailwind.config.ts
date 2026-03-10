import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,jsx,ts,tsx,mdx}', '../../packages/*/src/**/*.{js,jsx,ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
        panel: 'rgb(var(--color-panel-rgb) / <alpha-value>)',
        fg: 'rgb(var(--color-fg-rgb) / <alpha-value>)',
        muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        'accent-border': 'var(--color-accent-border)',
        'accent-contrast': 'var(--color-accent-contrast)',
        'accent-surface': 'var(--color-accent-surface)',
        'accent-strong': 'rgb(var(--color-accent-strong-rgb) / <alpha-value>)',
        border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
        'border-action': 'rgb(var(--color-border-action-rgb) / <alpha-value>)',
        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        'success-border': 'var(--color-success-border)',
        'success-surface': 'var(--color-success-surface)',
        'success-text': 'rgb(var(--color-success-text-rgb) / <alpha-value>)',
        error: 'rgb(var(--color-error-rgb) / <alpha-value>)',
        'error-border': 'var(--color-error-border)',
        'error-surface': 'var(--color-error-surface)',
        'error-text': 'rgb(var(--color-error-text-rgb) / <alpha-value>)',
        warning: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
        'warning-border': 'var(--color-warning-border)',
        'warning-surface': 'var(--color-warning-surface)',
        'warning-text': 'rgb(var(--color-warning-text-rgb) / <alpha-value>)',
      },
      borderRadius: {
        'app-sm': 'var(--radius-sm)',
        'app-md': 'var(--radius-md)',
        'app-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
    },
  },
  plugins: [],
};

export default config;
