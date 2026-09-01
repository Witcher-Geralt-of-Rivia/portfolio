import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The project's only ESLint configuration, and the only place ignores are
 * defined. There is no `.eslintignore` and no `eslintConfig` block in
 * package.json.
 *
 * Generated build output is never linted. `next build` writes thousands of
 * files into a dist directory; they are artefacts, not authored source, so
 * linting them reports errors in code nobody wrote. That is not merely noisy:
 * `deploy/safe-deploy.ps1` runs ESLint in its validate phase, so errors from
 * generated output would block every deployment.
 *
 * Production alternates between two release slots (see `next.config.ts`), so
 * all three dist directories are listed, not just the default `.next`.
 *
 * No source lint rule is relaxed or disabled anywhere in this file.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Dependencies. Also an ESLint built-in default, restated here so the full
    // set of skipped paths is auditable in one place.
    "node_modules/**",
    // Generated build output: development, plus both production release slots.
    ".next/**",
    ".next-release-a/**",
    ".next-release-b/**",
    // Restated from the eslint-config-next defaults this list replaces.
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
