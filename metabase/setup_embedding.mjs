import fs from "node:fs";
import crypto from "node:crypto";

/**
 * One-time (idempotent) setup: generates the account-wide embedding secret key Metabase uses to
 * verify signed JWTs from the backend, and enables static (signed) embedding. Run once; re-running
 * is a no-op if a key already exists (never silently rotates a key something else already signs
 * tokens with). See metabase/README.md's Embedding section.
 */

const CREDS_PATH = new URL("./credentials.json", import.meta.url);
const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8"));
const BASE = creds.url;

async function login() {
  const res = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: creds.email, password: creds.password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return (await res.json()).id;
}

async function main() {
  const sessionId = await login();
  const headers = { "Content-Type": "application/json", "X-Metabase-Session": sessionId };

  const settingsRes = await fetch(`${BASE}/api/setting`, { headers });
  const settings = await settingsRes.json();
  const existingKey = settings.find((s) => s.key === "embedding-secret-key")?.value;

  let secretKey = existingKey;
  if (!secretKey) {
    secretKey = crypto.randomBytes(32).toString("hex");
    const putRes = await fetch(`${BASE}/api/setting/embedding-secret-key`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value: secretKey }),
    });
    if (!putRes.ok) throw new Error(`Failed to set embedding-secret-key: ${putRes.status} ${await putRes.text()}`);
    console.log("Generated and set a new embedding secret key.");
  } else {
    console.log("Embedding secret key already set - leaving it as-is.");
  }

  const enableRes = await fetch(`${BASE}/api/setting/enable-embedding-static`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ value: true }),
  });
  if (!enableRes.ok) throw new Error(`Failed to enable static embedding: ${enableRes.status} ${await enableRes.text()}`);
  console.log("Static (signed) embedding enabled.");

  fs.writeFileSync(
    new URL("./embedding_key.json", import.meta.url),
    JSON.stringify({ embeddingSecretKey: secretKey }, null, 2)
  );
  console.log("Saved embedding_key.json (gitignored) - copy embeddingSecretKey into backend/.env as METABASE_EMBEDDING_SECRET_KEY.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
