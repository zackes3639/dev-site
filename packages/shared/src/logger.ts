export const logInfo = (message: string, meta: Record<string, unknown> = {}): void => {
  console.info(JSON.stringify({ level: "INFO", message, ...meta }));
};

export const logError = (message: string, meta: Record<string, unknown> = {}): void => {
  console.error(JSON.stringify({ level: "ERROR", message, ...meta }));
};
