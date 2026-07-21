// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When building for Hostinger (Node.js), set BUILD_TARGET=node so nitro emits a
// standalone Node server bundle at .output/server/index.mjs instead of a Cloudflare Worker.
const isNodeBuild = process.env.BUILD_TARGET === "node" || process.env.NITRO_PRESET === "node-server";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  ...(isNodeBuild
    ? {
        nitro: {
          preset: "node-server",
          output: {
            dir: "./.output",
            serverDir: "./.output/server",
            publicDir: "./.output/public",
          },
        },
      }
    : {}),
});
