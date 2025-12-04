// @ts-check

import noGetAccountResourceRule from "./custom-rules/no-get-account-resource.js";
import noGlobalAccountsStateRule from "./custom-rules/no-global-accounts-state.js";
import noGlobalPerpEngineStateRule from "./custom-rules/no-global-perp-engine-state.js";
import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import pluginImport from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import turboPlugin from "eslint-plugin-turbo";
import { dirname } from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export const baseConfig = tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  turboPlugin.configs["flat/recommended"],
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      import: pluginImport,
      "simple-import-sort": simpleImportSort,
      custom: {
        rules: {
          "no-get-account-resource": noGetAccountResourceRule,
          "no-global-perp-engine-state": noGlobalPerpEngineStateRule,
          "no-global-accounts-state": noGlobalAccountsStateRule,
        },
      },
    },
    rules: {
      // TypeScript
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
      // Imports
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-default-export": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // Stylistic
      curly: ["error", "all"],
      "object-shorthand": ["error", "always"],
      "custom/no-get-account-resource": "error",
      "custom/no-global-perp-engine-state": "error",
      "custom/no-global-accounts-state": "error",
    },
  },
  {
    files: ["eslint.config.mjs"],
    rules: {
      "import/no-default-export": "off",
    },
  },
  // This should come last since it disables any rules that might conflict with prettier
  eslintConfigPrettier,
);
