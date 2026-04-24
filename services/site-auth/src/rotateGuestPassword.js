const crypto = require("crypto");
const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({});

const GUEST_PASSWORD_PARAMETER = process.env.GUEST_PASSWORD_PARAMETER || "/zacksimon/site/guest-password";
const GUEST_PASSWORD_DATE_PARAMETER =
  process.env.GUEST_PASSWORD_DATE_PARAMETER || "/zacksimon/site/guest-password-date";

exports.handler = async () => {
  const password = generateGuestPassword();
  const date = new Date().toISOString().slice(0, 10);

  await Promise.all([
    putParameter(GUEST_PASSWORD_PARAMETER, password, "SecureString"),
    putParameter(GUEST_PASSWORD_DATE_PARAMETER, date, "String")
  ]);

  return { rotated: true, date };
};

function generateGuestPassword() {
  const words = ["Zack", "Guest", "Site", "Daily", "Pass", "Hello", "Share", "Visit"];
  const first = words[crypto.randomInt(words.length)];
  const second = words[crypto.randomInt(words.length)];
  const digits = String(crypto.randomInt(1000, 10000));
  const symbols = ["!!", "##", "$$", "%%"][crypto.randomInt(4)];
  return `${first}${second}${digits}${symbols}`;
}

async function putParameter(name, value, type) {
  await ssm.send(
    new PutParameterCommand({
      Name: name,
      Type: type,
      Value: value,
      Overwrite: true
    })
  );
}
