#!/usr/bin/env node
// Packages the Nitro Node build (.output) plus a minimal package.json
// into ./hostinger-upload, ready to zip and upload to Hostinger Node.js hosting.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".output");
const dest = join(root, "hostinger-upload");

if (!existsSync(outDir)) {
  console.error("[hostinger] .output not found. Run the build first.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// Copy the entire nitro node build
cpSync(outDir, join(dest, ".output"), { recursive: true });

// Minimal package.json so Hostinger can `npm install` (nothing to install –
// nitro bundles everything – but Hostinger requires the file) and `npm start`.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const shipPkg = {
  name: pkg.name || "app",
  version: pkg.version || "1.0.0",
  private: true,
  type: "module",
  scripts: {
    start: "node .output/server/index.mjs",
  },
};
writeFileSync(join(dest, "package.json"), JSON.stringify(shipPkg, null, 2));

// .env template – fill these in Hostinger's Environment Variables panel
const envTemplate = `# Fill these in Hostinger > Environment Variables (do NOT commit real values)
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
`;
writeFileSync(join(dest, ".env.example"), envTemplate);

writeFileSync(
  join(dest, "README.txt"),
  `Hostinger Node.js deployment bundle
====================================

1. Zip the CONTENTS of this folder (not the folder itself) and upload to Hostinger.
2. In Hostinger's Node.js app settings use:
   - Framework preset:  Other
   - Node version:      22.x
   - Package manager:   npm
   - Build command:     npm install
   - Output directory:  .output
   - Entry file:        .output/server/index.mjs
   - Start command:     npm start
3. Add all variables from .env.example under Environment Variables with real values.
4. Restart the app.
`,
);

console.log("[hostinger] Bundle ready at ./hostinger-upload");
