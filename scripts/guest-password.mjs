import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const command = process.argv[2];
const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const GUEST_PASSWORD_PARAMETER = process.env.GUEST_PASSWORD_PARAMETER || "/zacksimon/site/guest-password";
const GUEST_PASSWORD_DATE_PARAMETER =
  process.env.GUEST_PASSWORD_DATE_PARAMETER || "/zacksimon/site/guest-password-date";

if (!["rotate", "show"].includes(command)) {
  console.error("Usage: node scripts/guest-password.mjs <rotate|show>");
  process.exit(1);
}

if (command === "rotate") {
  const password = generateGuestPassword();
  const date = new Date().toISOString().slice(0, 10);

  putParameter(GUEST_PASSWORD_PARAMETER, password, "SecureString");
  putParameter(GUEST_PASSWORD_DATE_PARAMETER, date, "String");

  console.log(password);
} else {
  const password = getParameter(GUEST_PASSWORD_PARAMETER, true);
  const date = getParameter(GUEST_PASSWORD_DATE_PARAMETER, false);
  console.log(`${date} ${password}`);
}

function generateGuestPassword() {
  const words = ["Zack", "Guest", "Site", "Daily", "Pass", "Hello", "Share", "Visit"];
  const first = words[crypto.randomInt(words.length)];
  const second = words[crypto.randomInt(words.length)];
  const digits = String(crypto.randomInt(1000, 10000));
  const symbols = ["!!", "##", "$$", "%%"][crypto.randomInt(4)];
  return `${first}${second}${digits}${symbols}`;
}

function putParameter(name, value, type) {
  execFileSync(
    "aws",
    [
      "ssm",
      "put-parameter",
      "--name",
      name,
      "--type",
      type,
      "--value",
      value,
      "--overwrite",
      "--region",
      AWS_REGION,
      "--output",
      "text"
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
}

function getParameter(name, withDecryption) {
  const args = [
    "ssm",
    "get-parameter",
    "--name",
    name,
    "--region",
    AWS_REGION,
    "--query",
    "Parameter.Value",
    "--output",
    "text"
  ];
  if (withDecryption) {
    args.splice(4, 0, "--with-decryption");
  }

  return execFileSync("aws", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}
