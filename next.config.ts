import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // EdgeOne forwards to cine-relay.vercel.app; browsers send the public origin.
      allowedOrigins: ["cine-relay.vidall.top"],
    },
  },
};
export default config;
