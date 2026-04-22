import { randomUUID } from "node:crypto";

export const createId = (prefix: string): string => {
  const cleanPrefix = prefix.replace(/[^a-z0-9_]/gi, "").toLowerCase();
  const short = randomUUID().replace(/-/g, "").slice(0, 20);
  return `${cleanPrefix}_${short}`;
};
