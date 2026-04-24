import crypto from "node:crypto";
import fs from "node:fs";

const [templatePath, outputPath] = process.argv.slice(2);

if (!templatePath || !outputPath) {
  console.error("Usage: node scripts/render-site-access-gate.mjs <template> <output>");
  process.exit(1);
}

const password = process.env.SITE_ACCESS_PASSWORD;
const authEndpoint = process.env.SITE_AUTH_ENDPOINT || "";
const authSharedSecret = process.env.SITE_AUTH_SHARED_SECRET || "";

if (!password && !authEndpoint) {
  console.error("SITE_ACCESS_PASSWORD is required.");
  process.exit(1);
}

if (authEndpoint && !authSharedSecret) {
  console.error("SITE_AUTH_SHARED_SECRET is required when SITE_AUTH_ENDPOINT is set.");
  process.exit(1);
}

const salt = process.env.SITE_ACCESS_PASSWORD_SALT || crypto.randomBytes(16).toString("hex");
const sessionSecret = process.env.SITE_ACCESS_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const passwordHash = password ? crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex") : "";

const rendered = fs
  .readFileSync(templatePath, "utf8")
  .replaceAll("__SITE_ACCESS_PASSWORD_SALT__", salt)
  .replaceAll("__SITE_ACCESS_PASSWORD_HASH__", passwordHash)
  .replaceAll("__SITE_ACCESS_SESSION_SECRET__", sessionSecret)
  .replaceAll("__SITE_AUTH_ENDPOINT__", authEndpoint)
  .replaceAll("__SITE_AUTH_SHARED_SECRET__", authSharedSecret);

fs.writeFileSync(outputPath, rendered);
