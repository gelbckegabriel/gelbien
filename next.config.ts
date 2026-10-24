import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps recently visited pages alive in the background (React's Activity) instead of building them
  // again on every visit: going back to a tab is instant and it's as you left it. See (app)/template.tsx.
  cacheComponents: true,
  experimental: {
    // The app's pages are static (all their data comes from the client), so what's prefetched for them
    // only changes with a deploy: keep it a day, not the default five minutes. A phone's home-screen app
    // resumed after a while then opens pages at a tap instead of waiting on the network first.
    staleTimes: { static: 60 * 60 * 24 },
  },
};

export default nextConfig;
