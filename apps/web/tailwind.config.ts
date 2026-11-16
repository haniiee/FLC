import type { Config } from "tailwindcss";
import brandPreset from "@app/brand/tailwind-preset";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  presets: [brandPreset],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
