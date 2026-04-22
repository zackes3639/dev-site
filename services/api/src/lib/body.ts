import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ValidationError } from "./errors";

interface ParseOptions {
  allowEmpty?: boolean;
}

export const parseJsonBody = <T>(event: APIGatewayProxyEventV2, options: ParseOptions = {}): T => {
  if (!event.body) {
    if (options.allowEmpty) {
      return {} as T;
    }

    throw new ValidationError("Request body is required");
  }

  try {
    return JSON.parse(event.body) as T;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
};
