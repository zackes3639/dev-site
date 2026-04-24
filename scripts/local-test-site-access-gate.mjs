import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "site-access-gate-"));
const renderedPath = path.join(tmpDir, "site-access-gate.cjs");

execFileSync(
  process.execPath,
  ["scripts/render-site-access-gate.mjs", "edge/site-access-gate.js", renderedPath],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      SITE_ACCESS_PASSWORD: "correct-password",
      SITE_ACCESS_PASSWORD_SALT: "local-test-salt",
      SITE_ACCESS_SESSION_SECRET: "local-test-session-secret"
    },
    stdio: "inherit"
  }
);

const { handler } = await import(pathToFileURL(renderedPath));

function event({ method = "GET", uri = "/", querystring = "", headers = {}, body }) {
  return {
    Records: [
      {
        cf: {
          request: {
            method,
            uri,
            querystring,
            headers,
            ...(body ? { body } : {})
          }
        }
      }
    ]
  };
}

function invoke(input) {
  return new Promise((resolve, reject) => {
    handler(input, {}, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

const login = await invoke(event({ uri: "/" }));
assert.equal(login.status, "200");
assert.match(login.body, /<form method="post" action="\/__site-login"/);

const blockedDeepLink = await invoke(event({ uri: "/blog/", querystring: "x=1" }));
assert.equal(blockedDeepLink.status, "302");
assert.equal(blockedDeepLink.headers.location[0].value, "/?returnTo=%2Fblog%2F%3Fx%3D1");

const wrongPassword = await invoke(
  event({
    method: "POST",
    uri: "/__site-login",
    body: {
      encoding: "base64",
      data: Buffer.from("password=wrong&returnTo=%2Fblog%2F").toString("base64")
    }
  })
);
assert.equal(wrongPassword.status, "200");
assert.match(wrongPassword.body, /That password did not work/);

const unsupportedMethod = await invoke(event({ method: "POST", uri: "/blog/" }));
assert.equal(unsupportedMethod.status, "405");

const correctPassword = await invoke(
  event({
    method: "POST",
    uri: "/__site-login",
    body: {
      encoding: "base64",
      data: Buffer.from("password=correct-password&returnTo=%2Fblog%2F").toString("base64")
    }
  })
);
assert.equal(correctPassword.status, "303");
assert.equal(correctPassword.headers.location[0].value, "/blog/");
assert.match(correctPassword.headers["set-cookie"][0].value, /HttpOnly; Secure; SameSite=Lax/);

const authedDeepLink = await invoke(
  event({
    uri: "/blog",
    headers: {
      cookie: [{ key: "Cookie", value: correctPassword.headers["set-cookie"][0].value.split(";")[0] }]
    }
  })
);
assert.equal(authedDeepLink.uri, "/blog/index.html");

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("Site access gate local tests passed.");
