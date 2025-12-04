// @ts-check

import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import { baseConfig } from "./base.js";

export const reactLibConfig = tseslint.config(...baseConfig, pluginReact.configs.flat.recommended, {
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
  },
  settings: { react: { version: "detect" } },
  plugins: {
    "react-hooks": pluginReactHooks,
  },
  rules: {
    ...pluginReact.configs.flat.recommended.rules,
    // React scope no longer necessary with new JSX transform.
    "react/react-in-jsx-scope": "off",
    "react/self-closing-comp": ["error", { component: true, html: true }],
    "react/jsx-curly-brace-presence": ["error", { props: "never" }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error",
  },
});
