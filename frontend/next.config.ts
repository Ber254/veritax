import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(import.meta.dirname, "..");

const config: NextConfig = {
  serverExternalPackages: [
    "@lucid-evolution/lucid",
    "@anastasia-labs/cardano-multiplatform-lib-nodejs",
    "@lucid-evolution/uplc",
  ],
  outputFileTracingRoot: root,
  turbopack: { root },
};

export default config;
