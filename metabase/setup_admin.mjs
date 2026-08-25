import fs from "node:fs";
import crypto from "node:crypto";

const BASE = "http://localhost:3000";
const CREDS_PATH = new URL("./credentials.json", import.meta.url);

async function main() {
  const propsRes = await fetch(`${BASE}/api/session/properties`);
  const props = await propsRes.json();

  if (!props["setup-token"]) {
    console.log("Setup already completed (no setup-token). Existing credentials.json (if any):");
    if (fs.existsSync(CREDS_PATH)) console.log(fs.readFileSync(CREDS_PATH, "utf8"));
    return;
  }

  const password = "Mb-" + crypto.randomBytes(12).toString("base64url") + "!1";
  const email = "it-admin@vianaar.local";

  const setupBody = {
    token: props["setup-token"],
    user: {
      first_name: "IT",
      last_name: "Admin",
      email,
      password,
      site_name: "Vianaar IT Asset Management",
    },
    prefs: {
      site_name: "Vianaar IT Asset Management",
      site_locale: "en",
      allow_tracking: false,
    },
  };

  const setupRes = await fetch(`${BASE}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(setupBody),
  });

  if (!setupRes.ok) {
    console.error("Setup failed:", setupRes.status, await setupRes.text());
    process.exit(1);
  }

  const setupData = await setupRes.json();
  const sessionId = setupData.id;
  console.log("Admin account created:", email);

  fs.writeFileSync(
    CREDS_PATH,
    JSON.stringify({ url: BASE, email, password, sessionId }, null, 2)
  );
  console.log("Saved credentials to metabase/credentials.json (gitignored)");

  // Add the MongoDB connection.
  const dbBody = {
    engine: "mongo",
    name: "IT Asset Management",
    details: {
      "use-conn-uri": false,
      host: "127.0.0.1",
      port: 27017,
      dbname: "it_asset_management",
      user: "",
      pass: "",
      authdb: "",
      "additional-options": "",
      "use-srv": false,
      ssl: false,
    },
    is_full_sync: true,
    is_on_demand: false,
  };

  const dbRes = await fetch(`${BASE}/api/database`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Metabase-Session": sessionId },
    body: JSON.stringify(dbBody),
  });

  const dbText = await dbRes.text();
  if (!dbRes.ok) {
    console.error("Add database failed:", dbRes.status, dbText);
    process.exit(1);
  }
  const dbData = JSON.parse(dbText);
  console.log("Database connection created, id =", dbData.id);

  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
  creds.databaseId = dbData.id;
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
