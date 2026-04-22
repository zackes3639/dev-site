import { json } from "@briefly/shared";

export const handler = async () => {
  return json(200, {
    service: "briefly-api",
    status: "ok",
    timestamp: new Date().toISOString()
  });
};
