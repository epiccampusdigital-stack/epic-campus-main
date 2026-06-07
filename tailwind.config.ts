import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        'dm-sans': ['DM Sans', 'sans-serif'],
        'noto-jp': ['Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
