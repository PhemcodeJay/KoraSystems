import type { Config } from "tailwindcss";
import { COLOR } from "@kora/brand";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kora brand scales, sourced from @kora/brand so the web app and
        // Expo cannot drift apart.
        brand: COLOR.primary,
        accent: COLOR.accent,
        blue: COLOR.blue,
        ink: COLOR.neutral,
        success: COLOR.success.DEFAULT,
        warning: COLOR.warning.DEFAULT,
        danger: COLOR.danger.DEFAULT,
        info: COLOR.info.DEFAULT,
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
