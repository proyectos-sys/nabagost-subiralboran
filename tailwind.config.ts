import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        metal: {
          50: "#f6f7f7",
          100: "#e1e5e6",
          500: "#647074",
          900: "#172023"
        },
        safety: {
          500: "#f5b642",
          700: "#9a5b00"
        }
      },
      boxShadow: {
        "tablet": "0 10px 30px rgba(15, 23, 42, 0.10)"
      }
    },
  },
  plugins: [],
};

export default config;
