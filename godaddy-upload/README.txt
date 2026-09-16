GoDaddy Node.js deployment bundle
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
   real values (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY,
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
  dependencies).
- The app needs outbound internet access to reach the backend (database)
  API — no inbound ports besides the app's own port.
