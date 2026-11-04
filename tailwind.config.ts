import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#1f2937", calm: "#0d9488", soft: "#f1f5f9" },
    },
  },
  plugins: [],
};
export default config;
