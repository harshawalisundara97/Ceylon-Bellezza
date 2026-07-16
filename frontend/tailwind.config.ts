import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#faf6f0",
        ink: "#2b241d",
        taupe: "#8a7c6c",
        terracotta: {
          DEFAULT: "#a6784f",
          light: "#e8c9a0",
        },
        hairline: "#e8ddd0",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
