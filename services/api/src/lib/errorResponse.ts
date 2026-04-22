import { json, logError } from "@briefly/shared";
import { AppError } from "./errors";

export const toErrorResponse = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AppError) {
    return json(error.statusCode, {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  logError("unhandled_error", { error: String(error) });
  return json(500, { code: "internal_error", message: fallbackMessage });
};
