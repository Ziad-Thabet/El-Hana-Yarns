import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        {
          type: "feature-internal",
          pattern: "src/features/*/components/**",
          capture: ["domain"],
        },
        {
          type: "feature-public",
          pattern: "src/features/*/types.ts",
          capture: ["domain"],
        },
        {
          type: "feature-public",
          pattern: "src/features/*/hooks.ts",
          capture: ["domain"],
        },
        {
          type: "lib-barrel",
          pattern: "src/lib/types.ts",
        },
        {
          type: "lib-barrel",
          pattern: "src/lib/hooks/index.ts",
        },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: "feature-internal" },
              disallow: {
                to: {
                  type: "feature-internal",
                  captured: { domain: "!{{from.domain}}" },
                },
              },
              message:
                "A feature's components folder cannot import another feature's components folder directly. Import from that feature's types.ts or hooks.ts instead (or move shared UI into src/components/).",
            },
            {
              from: { type: ["feature-internal", "feature-public"] },
              disallow: { to: { type: "lib-barrel" } },
              message:
                "Don't import the lib barrel (src/lib/types.ts or src/lib/hooks/index.ts) from inside a feature — that's backwards (the barrel re-exports FROM features). Import directly from this feature's own types.ts/hooks.ts, or the other feature's types.ts/hooks.ts.",
            },
          ],
        },
      ],
    },
  },
);
