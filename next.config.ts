import type { NextConfig } from "next";

/**
 * Production build slot.
 *
 * Production never serves the default `.next`. It alternates between two
 * release directories, so `next build` can never rewrite files the running
 * production process is reading — the failure that took the live site down
 * twice during Stage 05.
 *
 *   development / local build   .next
 *   production release slots    .next-release-a  /  .next-release-b
 *
 * The value is supplied per-process by deploy/safe-deploy.ps1 and by the PM2
 * process definition. It is not a secret, but it does select a filesystem
 * path, so it is validated against an explicit allow-list rather than trusted:
 * an absolute path or a traversal here would point the build, or the running
 * server, somewhere it has no business being.
 */
const ALLOWED_DIST_DIRS = [".next", ".next-release-a", ".next-release-b"];

function resolveDistDir(): string {
  const requested = process.env.PORTFOLIO_DIST_DIR?.trim();
  if (!requested) return ".next";

  if (!ALLOWED_DIST_DIRS.includes(requested)) {
    throw new Error(
      `PORTFOLIO_DIST_DIR must be one of ${ALLOWED_DIST_DIRS.join(", ")} — received "${requested}". ` +
        "Refusing to build or serve from an unexpected directory."
    );
  }
  return requested;
}

const nextConfig: NextConfig = {
  distDir: resolveDistDir(),

  /**
   * The dev server is reached over the VPS public IP for remote preview.
   * Next blocks /_next/* dev resources (chunks, HMR socket) coming from an
   * origin it does not recognise, so the preview host has to be listed here.
   * 127.0.0.1 is listed explicitly: Next's default allowance covers the
   * hostname `localhost` but not the literal loopback address, which the
   * QA harness uses.
   * Dev-only: this has no effect on `next build` or `next start`.
   */
  allowedDevOrigins: ["108.186.112.75", "localhost", "127.0.0.1"],
};

export default nextConfig;
