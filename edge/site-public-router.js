function handler(event, _context, callback) {
  const request = event.Records[0].cf.request;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return callback(null, methodNotAllowed());
  }

  rewriteUri(request);
  return callback(null, request);
}

function rewriteUri(request) {
  if (request.uri.endsWith("/")) {
    request.uri += "index.html";
  } else if (!request.uri.includes(".")) {
    request.uri += "/index.html";
  }
}

function methodNotAllowed() {
  return {
    status: "405",
    statusDescription: "Method Not Allowed",
    headers: {
      allow: [{ key: "Allow", value: "GET, HEAD" }],
      "cache-control": [{ key: "Cache-Control", value: "no-store" }]
    },
    body: "Method Not Allowed"
  };
}

exports.handler = handler;
