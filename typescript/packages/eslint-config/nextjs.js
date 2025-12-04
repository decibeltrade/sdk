// @ts-check

import nextPlugin from "@next/eslint-plugin-next";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { dirname } from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
import { baseConfig } from "./base.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const nextjsConfig = tseslint.config(
  ...baseConfig,
  {
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "@next/next": nextPlugin,
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      "@next/next/no-img-element": "error",
      "react/self-closing-comp": ["error", { component: true, html: true }],
      "react/jsx-curly-brace-presence": ["error", { props: "never" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: [
      "./src/app/**/?(layout|page|loading|not-found|error|global-error|template|default).tsx",
      "./src/i18n/request.ts",
      "./*.config.ts",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },
);
