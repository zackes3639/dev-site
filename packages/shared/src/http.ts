export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export const json = (statusCode: number, body: unknown): HttpResponse => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS"
  },
  body: JSON.stringify(body)
});
