import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0d12',
        panel: '#11151c',
        panel2: '#161b24',
        line: '#222a36',
        ink: '#e6ebf2',
        muted: '#8a97a8',
        accent: '#3b82f6',
        ok: '#22c55e',
        warn: '#eab308',
        err: '#ef4444',
      },
      fontFamily: { sans: ['ui-sans-serif', 'Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'monospace'] },
    },
  },
  plugins: [],
};
export default config;
