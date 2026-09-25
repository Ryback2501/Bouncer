// Security behaviour follows what the deployment actually is — never the NODE_ENV label. The image
// is routinely run as development/test, and keying these to `NODE_ENV === "production"` switched
// them off there (B-07).

/** Cookies are marked Secure exactly when Bouncer is served over https. */
export function isHttpsOrigin(origin: string): boolean {
  return new URL(origin).protocol === "https:";
}

/**
 * Express "trust proxy" value. An explicit TRUST_PROXY wins (boolean, hop count, or subnet/IP
 * list). Otherwise trust one hop only for an https origin: Bouncer never terminates TLS itself, so
 * https means a TLS proxy is in front. Behind no proxy, trusting X-Forwarded-For would let a client
 * choose its own IP and slip past the per-IP rate limits.
 */
export function trustProxySetting(trustProxy: string | undefined, origin: string): boolean | number | string {
  const tp = trustProxy?.trim();
  if (!tp) return isHttpsOrigin(origin) ? 1 : false;
  if (tp === "true") return true;
  if (tp === "false") return false;
  return /^\d+$/.test(tp) ? Number(tp) : tp;
}
