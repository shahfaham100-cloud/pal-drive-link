// GoDaddy cPanel Node.js app startup file (Phusion Passenger).
// Passenger sets the PORT env var; the nitro node-server build already
// honors process.env.PORT, so we simply import the server entry.
import("./.output/server/index.mjs");
