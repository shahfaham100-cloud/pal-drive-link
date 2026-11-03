#!/usr/bin/env node
// Packages the Nitro Node build (.output) plus a minimal package.json and
// .htaccess into ./godaddy-upload, ready to zip and upload to GoDaddy
// (cPanel "Setup Node.js App" or VPS Node.js hosting).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, ".output");
const dest = join(root, "godaddy-upload");

if (!existsSync(outDir)) {
  console.error("[godaddy] .output not found. Run the build first.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// Copy the entire nitro node build
cpSync(outDir, join(dest, ".output"), { recursive: true });

// Minimal package.json – nitro bundles everything, nothing to install.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const shipPkg = {
  name: pkg.name || "app",
  version: pkg.version || "1.0.0",
  private: true,
  type: "module",
  scripts: {
    // GoDaddy's PaaS flow runs `npm run build` before starting the app.
    // Everything is already bundled in .output, so this is a no-op that
    // just satisfies the build step (previously caused: Missing script "build").
    build: "node -e \"console.log('Prebuilt bundle — nothing to build')\"",
    start: "node .output/server/index.mjs",
  },
};
writeFileSync(join(dest, "package.json"), JSON.stringify(shipPkg, null, 2));

// App entry for cPanel "Setup Node.js App" (Phusion Passenger).
// Passenger loads app.js and proxies to the app; we just start the server
// listening on the port Passenger provides via process.env.PORT.
writeFileSync(
  join(dest, "app.js"),
  `// GoDaddy cPanel Node.js app startup file (Phusion Passenger).
// Passenger sets the PORT env var; the nitro node-server build already
// honors process.env.PORT, so we simply import the server entry.
import("./.output/server/index.mjs");
`,
);

// .env template – fill these in GoDaddy's Environment Variables panel
const envTemplate = `# Fill these in GoDaddy > Environment Variables (do NOT commit real values)
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
# The server reads PORT automatically (GoDaddy/cPanel sets it).
`;
writeFileSync(join(dest, ".env.example"), envTemplate);

writeFileSync(
  join(dest, "README.txt"),
  `GoDaddy Node.js deployment bundle
==================================

Option A - cPanel "Setup Node.js App" (shared/business hosting)
---------------------------------------------------------------
1. Zip the CONTENTS of this folder (not the folder itself) and upload to the
   app's Application root folder (e.g. /home/<user>/nodejs/myapp), then unzip.
2. In cPanel > Setup Node.js App:
   - Node.js version:    22.x (or highest available)
   - Application mode:   Production
   - Application root:   the folder where you uploaded the files
   - Application URL:    your domain/subdomain
   - Application startup file:  app.js
3. Under "Environment Variables" add every variable from .env.example with
   real values (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,
   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID).
4. Click "Restart".

Option B - VPS / GoDaddy managed Node hosting
---------------------------------------------
1. Zip the CONTENTS of this folder, upload, and unzip on the server.
2. Set the environment variables from .env.example.
3. Run:  npm start   (equivalent to: node .output/server/index.mjs)
   Optionally run it under pm2:  pm2 start .output/server/index.mjs
4. Point your reverse proxy (Apache/Nginx) to the port the app listens on
   (PORT env var, default 3000).

Notes
-----
- Everything is bundled; "npm install" is not required (package.json has no
  dependencies). The "build" script is a no-op placeholder because the app
  is prebuilt — GoDaddy's deploy pipeline runs "npm run build" before start.
- The app needs outbound internet access to reach the backend (database)
  API — no inbound ports besides the app's own port.
`,
);

console.log("[godaddy] Bundle ready at ./godaddy-upload");
