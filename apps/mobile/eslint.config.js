import { baseConfig } from "@app/eslint-config/base";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: [
      "android/**",
      "ios/**",
      ".expo/**",
      "dist/**",
      "node_modules/**",
      "babel.config.cjs",
      "metro.config.cjs",
    ],
  },
];
