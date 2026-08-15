const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const projectRoot = __dirname;
const dotenv = loadDotEnv(path.join(projectRoot, ".env"));

module.exports = {
  apps: [{
    name: "pharmaconnect-growth-engine",
    script: "/home/inboxingproweb/pharmaconnect-growth-engine/artifacts/api-server/dist/index.mjs",
    cwd: "/home/inboxingproweb/pharmaconnect-growth-engine",
    env: {
      PORT: "3001",
      BASE_PATH: "/",
      NODE_ENV: "production",
      DEFAULT_PROJECT_SLUG: "pharmaconnect",
      APP_DOMAIN: "https://app.pharmaconnect.uk",
      PUBLIC_SITE_DOMAIN: "https://pharmaconnect.uk",
      STATIC_SITE_DOMAIN: "https://app.pharmaconnect.uk",
      WORKSPACE_ROOT: "/home/inboxingproweb/pharmaconnect-growth-engine",
      GOOGLE_PLACES_API_KEY: dotenv.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "",
      SESSION_SECRET: process.env.SESSION_SECRET,
      IDEOGRAM_API_KEY: "3mRH8OJejedcy9dl7tjTl0KU8_btZWHgisKchKY5KfTHcPOwueC7OenmYrW0-8CkRmYFo6HoPe9tiTaWNlCViA",
      DEPLOY_USERNAME: "pharmaconnect@dhmdigital.net",
      DEPLOY_PASSWORD: "B?CjrN5ZYXQM2ee6"
    }
  }]
};
