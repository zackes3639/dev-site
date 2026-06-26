export class CognitoAuthError extends Error {
  readonly code: string;

  constructor(message: string, code = "cognito_auth_error") {
    super(message);
    this.code = code;
  }
}

interface SignInOptions {
  email: string;
  password: string;
  region: string;
  clientId: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseCognitoError = async (response: Response): Promise<CognitoAuthError> => {
  let payload: unknown = {};
  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = {};
  }

  if (isObject(payload)) {
    const codeValue = payload.__type ?? payload.code ?? payload.Code;
    const rawCode = typeof codeValue === "string" ? codeValue.split("#").pop() ?? codeValue : "cognito_auth_error";
    const message = typeof payload.message === "string" ? payload.message : `Cognito sign-in failed with status ${response.status}`;
    return new CognitoAuthError(message, rawCode);
  }

  return new CognitoAuthError(`Cognito sign-in failed with status ${response.status}`);
};

export const signInWithCognito = async (options: SignInOptions): Promise<string> => {
  const response = await fetch(`https://cognito-idp.${options.region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth"
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: options.clientId,
      AuthParameters: {
        USERNAME: options.email,
        PASSWORD: options.password
      }
    })
  });

  if (!response.ok) {
    throw await parseCognitoError(response);
  }

  const payload = (await response.json()) as unknown;
  if (!isObject(payload)) {
    throw new CognitoAuthError("Cognito returned an invalid response.");
  }

  if (typeof payload.ChallengeName === "string") {
    throw new CognitoAuthError(`Cognito challenge is required: ${payload.ChallengeName}`, "challenge_required");
  }

  const authResult = payload.AuthenticationResult;
  if (!isObject(authResult) || typeof authResult.IdToken !== "string") {
    throw new CognitoAuthError("Cognito did not return an ID token.");
  }

  return authResult.IdToken;
};
