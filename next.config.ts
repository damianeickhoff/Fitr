import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Traces the server into `.next/standalone`, so a container image is the build plus Node. */
  output: "standalone",
  poweredByHeader: false,
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
