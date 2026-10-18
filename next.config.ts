import os from "node:os";
import type { NextConfig } from "next";

/**
 * This computer's own network addresses. The dev server only serves its
 * scripts to localhost by default, so a phone opening the app on the LAN
 * address (the desktop QR code) got pages whose buttons never came alive —
 * no photo upload, no tabs. Read at start-up; restart if the address changes.
 */
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  /** Traces the server into `.next/standalone`, so a container image is the build plus Node. */
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: lanAddresses,
  // Native ONNX runtime and its model files: loaded from node_modules at run
  // time, never bundled.
  serverExternalPackages: ["@imgly/background-removal-node", "onnxruntime-node"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@imgly/background-removal-node/dist/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Photos are shrunk in the browser first, but a browser that can't decode
      // one sends the original, and phone originals run to 10 MB.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
