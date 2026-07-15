import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#B8860B",
          dark: "#8B6508",
        },
      },
    },
  },
  plugins: [],
};

export default config;
