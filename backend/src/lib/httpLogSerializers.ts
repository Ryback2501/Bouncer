import { redactUrl, redactQuery } from "./redactUrl";

// pino-http serializes the request once, as a child-logger binding, and by default wraps a custom
// serializer around its own — so these receive the already-serialized object, not the raw
// req/res. Both are exported so the redaction can be tested directly rather than only through the
// helper, since this is the part that actually wires it in.

interface SerializedReq {
  url?: string;
  query?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SerializedRes {
  headers?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Strip credentials from the logged request URL and its parsed query. */
export function redactReq(req: SerializedReq): SerializedReq {
  if (typeof req.url === "string") req.url = redactUrl(req.url);
  // `query` is a sibling of `url`, so sanitising the URL string alone would still leak it.
  if (req.query && typeof req.query === "object") req.query = redactQuery(req.query);
  return req;
}

/** Strip credentials from the logged response headers — `Location` carries the OAuth `state`. */
export function redactRes(res: SerializedRes): SerializedRes {
  const location = res.headers?.location;
  if (typeof location === "string") {
    res.headers = { ...res.headers, location: redactUrl(location) };
  }
  return res;
}
