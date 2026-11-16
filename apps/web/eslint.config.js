import config from "@app/eslint-config/next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    ignores: ["public/sw.js", "public/sw.js.map", "public/swe-worker*"],
  },
];
