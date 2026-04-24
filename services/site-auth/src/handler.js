const crypto = require("crypto");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({});

const OWNER_PASSWORD_PARAMETER = process.env.OWNER_PASSWORD_PARAMETER || "/zacksimon/site/owner-password";
const GUEST_PASSWORD_PARAMETER = process.env.GUEST_PASSWORD_PARAMETER || "/zacksimon/site/guest-password";
const GUEST_PASSWORD_DATE_PARAMETER =
  process.env.GUEST_PASSWORD_DATE_PARAMETER || "/zacksimon/site/guest-password-date";
const SITE_AUTH_SHARED_SECRET = process.env.SITE_AUTH_SHARED_SECRET || "";

exports.handler = async (event) => {
  if (!hasValidSharedSecret(event)) {
    return json(403, { ok: false });
  }

  let password = "";
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    password = typeof body.password === "string" ? body.password : "";
  } catch (_error) {
    return json(400, { ok: false });
  }

  if (!password) {
    return json(200, { ok: false });
  }

  const [ownerPassword, guestPassword, guestDate] = await Promise.all([
    getOptionalParameter(OWNER_PASSWORD_PARAMETER, true),
    getOptionalParameter(GUEST_PASSWORD_PARAMETER, true),
    getOptionalParameter(GUEST_PASSWORD_DATE_PARAMETER, false)
  ]);

  if (ownerPassword && timingSafeEqual(password, ownerPassword)) {
    return json(200, { ok: true, kind: "owner" });
  }

  if (guestPassword && guestDate === todayUtc() && timingSafeEqual(password, guestPassword)) {
    return json(200, { ok: true, kind: "guest" });
  }

  return json(200, { ok: false });
};

function hasValidSharedSecret(event) {
  if (!SITE_AUTH_SHARED_SECRET) {
    return false;
  }

  const headers = event.headers || {};
  const provided =
    headers["x-site-auth-secret"] ||
    headers["X-Site-Auth-Secret"] ||
    headers["X-SITE-AUTH-SECRET"] ||
    "";

  return timingSafeEqual(String(provided), SITE_AUTH_SHARED_SECRET);
}

async function getOptionalParameter(name, withDecryption) {
  try {
    const response = await ssm.send(
      new GetParameterCommand({
        Name: name,
        WithDecryption: withDecryption
      })
    );

    return response.Parameter && response.Parameter.Value ? response.Parameter.Value : "";
  } catch (error) {
    if (error && error.name === "ParameterNotFound") {
      return "";
    }

    throw error;
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
