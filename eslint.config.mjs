import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    // Production release slots (see next.config.ts). These hold generated
    // build output exactly like .next does, so they are ignored for the same
    // reason -- linting them reports errors in code we did not write.
    ".next-release-a/**",
    ".next-release-b/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
