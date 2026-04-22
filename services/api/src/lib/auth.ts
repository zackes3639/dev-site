import type { APIGatewayProxyEventV2 } from "aws-lambda";

export interface RequestIdentity {
  userId: string;
  email?: string;
}

export const requireIdentity = (event: APIGatewayProxyEventV2): RequestIdentity => {
  const jwt = (event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } })
    .authorizer?.jwt;
  const sub = jwt?.claims?.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("Unauthorized: missing JWT subject");
  }

  const emailClaim = jwt?.claims?.email;
  if (typeof emailClaim === "string" && emailClaim.length > 0) {
    return {
      userId: sub,
      email: emailClaim
    };
  }

  return {
    userId: sub
  };
};
