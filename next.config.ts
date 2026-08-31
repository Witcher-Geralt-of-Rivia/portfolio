import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
