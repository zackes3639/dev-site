const crypto = require("crypto");
const querystring = require("querystring");

const PASSWORD_SALT = "__SITE_ACCESS_PASSWORD_SALT__";
const PASSWORD_HASH = "__SITE_ACCESS_PASSWORD_HASH__";
const SESSION_SECRET = "__SITE_ACCESS_SESSION_SECRET__";
const COOKIE_NAME = "site_access";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function handler(event, _context, callback) {
  const request = event.Records[0].cf.request;
  const originalTarget = request.uri + (request.querystring ? `?${request.querystring}` : "");

  if (request.method === "POST" && request.uri === "/__site-login") {
    return callback(null, handleLogin(request));
  }

  if (!hasValidSession(request)) {
    if (request.uri === "/" || request.uri === "/index.html") {
      return callback(null, loginPage(getReturnTo(request) || "/", false));
    }

    return callback(null, redirect(`/?returnTo=${encodeURIComponent(originalTarget)}`, 302));
  }

  rewriteUri(request);
  return callback(null, request);
}

function handleLogin(request) {
  const body = parseBody(request);
  const returnTo = safeReturnTo(body.returnTo || "/");
  const password = typeof body.password === "string" ? body.password : "";

  if (!isCorrectPassword(password)) {
    return loginPage(returnTo, true);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const value = `${expiresAt}.${signSession(expiresAt)}`;

  return redirect(returnTo, 303, {
    "set-cookie": [
      {
        key: "Set-Cookie",
        value: `${COOKIE_NAME}=${value}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
      }
    ]
  });
}

function parseBody(request) {
  if (!request.body || !request.body.data || request.body.inputTruncated) {
    return {};
  }

  const raw =
    request.body.encoding === "base64"
      ? Buffer.from(request.body.data, "base64").toString("utf8")
      : request.body.data;

  return querystring.parse(raw);
}

function isCorrectPassword(password) {
  const attemptedHash = crypto.createHash("sha256").update(`${PASSWORD_SALT}:${password}`).digest("hex");
  return timingSafeEqual(attemptedHash, PASSWORD_HASH);
}

function hasValidSession(request) {
  const cookies = parseCookies(getHeader(request, "cookie"));
  const value = cookies[COOKIE_NAME];
  if (!value) {
    return false;
  }

  const parts = value.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  return timingSafeEqual(parts[1], signSession(expiresAt));
}

function signSession(expiresAt) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(String(expiresAt)).digest("base64url");
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) {
    return cookies;
  }

  headerValue.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) {
      return;
    }

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) {
      cookies[name] = value;
    }
  });

  return cookies;
}

function getHeader(request, name) {
  const values = request.headers[name.toLowerCase()];
  return values && values[0] ? values[0].value : "";
}

function getReturnTo(request) {
  const params = querystring.parse(request.querystring || "");
  return safeReturnTo(params.returnTo);
}

function safeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function rewriteUri(request) {
  if (request.uri.endsWith("/")) {
    request.uri += "index.html";
  } else if (!request.uri.includes(".")) {
    request.uri += "/index.html";
  }
}

function redirect(location, status, extraHeaders) {
  return {
    status: String(status),
    statusDescription: status === 303 ? "See Other" : "Found",
    headers: {
      location: [{ key: "Location", value: location }],
      "cache-control": [{ key: "Cache-Control", value: "no-store" }],
      ...(extraHeaders || {})
    }
  };
}

function loginPage(returnTo, showError) {
  const escapedReturnTo = escapeHtml(returnTo);
  const error = showError ? '<p class="error">That password did not work.</p>' : "";

  return {
    status: "200",
    statusDescription: "OK",
    headers: {
      "content-type": [{ key: "Content-Type", value: "text/html; charset=utf-8" }],
      "cache-control": [{ key: "Cache-Control", value: "no-store" }]
    },
    body: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>zacksimon.dev</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f1e8;
      color: #171717;
    }
    main {
      width: min(100% - 32px, 380px);
      display: grid;
      gap: 18px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0;
    }
    form {
      display: grid;
      gap: 12px;
    }
    label {
      display: grid;
      gap: 7px;
      font-size: 14px;
      font-weight: 600;
    }
    input, button {
      width: 100%;
      min-height: 46px;
      border-radius: 8px;
      font: inherit;
    }
    input {
      border: 1px solid #b9b09f;
      padding: 0 12px;
      background: #fffaf0;
      color: #171717;
    }
    button {
      border: 0;
      background: #171717;
      color: #fffaf0;
      font-weight: 700;
      cursor: pointer;
    }
    .error {
      margin: 0;
      color: #9f1d1d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <main>
    <h1>zacksimon.dev</h1>
    <form method="post" action="/__site-login" autocomplete="off">
      <input type="hidden" name="returnTo" value="${escapedReturnTo}">
      <label>
        Password
        <input name="password" type="password" required autofocus>
      </label>
      ${error}
      <button type="submit">Enter</button>
    </form>
  </main>
</body>
</html>`
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

exports.handler = handler;
