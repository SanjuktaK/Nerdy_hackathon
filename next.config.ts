import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // localhost and 127.0.0.1 keep separate browser storage, so the app can run
  // as two independent "devices" side by side (e.g. a fresh setup next to one
  // with history). Development only: the dev server blocks other hosts by default.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
