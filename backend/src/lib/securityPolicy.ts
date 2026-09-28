// Security behaviour follows what the deployment actually is — never the NODE_ENV label. The image
// is routinely run as development/test, and keying these to `NODE_ENV === "production"` switched
// them off there (B-07).

import proxyaddr from "proxy-addr";

/** Cookies are marked Secure exactly when Bouncer is served over https. */
export function isHttpsOrigin(origin: string): boolean {
  return new URL(origin).protocol === "https:";
}

/**
 * Express "trust proxy" value. An explicit TRUST_PROXY wins (`false`, hop count, or subnet/IP
 * list; `true` is rejected at startup, see trustProxyError). Otherwise trust one hop only for an
 * https origin: Bouncer never terminates TLS itself, so https means a TLS proxy is in front. Behind
 * no proxy, trusting X-Forwarded-For would let a client choose its own IP and slip past the per-IP
 * rate limits.
 */
export function trustProxySetting(trustProxy: string | undefined, origin: string): false | number | string {
  const tp = trustProxy?.trim();
  if (!tp) return isHttpsOrigin(origin) ? 1 : false;
  if (tp.toLowerCase() === "false") return false;
  return /^\d+$/.test(tp) ? Number(tp) : tp;
}

/**
 * Startup check for TRUST_PROXY (B-09). `true` trusts every hop, so req.ip becomes the left-most
 * X-Forwarded-For entry — chosen by the client — and each spoofed value gets a fresh rate-limit
 * bucket. Anything else must be something Express can compile; it is checked with the same
 * parser (proxy-addr) so a typo fails here instead of crashing createApp().
 */
export function trustProxyError(trustProxy: string | undefined): string | null {
  const tp = trustProxy?.trim();
  if (!tp || tp.toLowerCase() === "false" || /^\d+$/.test(tp)) return null;
  if (tp.toLowerCase() === "true") {
    return (
      "must not be true: it trusts every hop, so any client can set its own IP via " +
      "X-Forwarded-For and bypass the rate limits. Set the number of proxies in front of " +
      "Bouncer (e.g. 1) or their IPs/subnets instead"
    );
  }
  try {
    proxyaddr.compile(tp.split(",").map((s) => s.trim()));
    return null;
  } catch {
    return (
      "must be false, a hop count, or a comma-separated list of proxy IPs/subnets " +
      "(loopback, linklocal and uniquelocal are also accepted)"
    );
  }
}

/**
 * Startup advice for the one setup the default can get wrong: an http origin that is not
 * localhost, with TRUST_PROXY unset. That is usually a plain-http reverse proxy (e.g. on a LAN).
 * Without TRUST_PROXY every user then shares the proxy's IP, and so one rate-limit bucket.
 */
export function missingTrustProxyWarning(trustProxy: string | undefined, origin: string): string | null {
  if (trustProxy?.trim() || isHttpsOrigin(origin)) return null;
  const host = new URL(origin).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return null;
  return (
    `FRONTEND_URL is http://${host} and TRUST_PROXY is unset, so no proxy is trusted. If a reverse ` +
    "proxy is in front of Bouncer, set TRUST_PROXY=1 or every user shares the proxy's rate limit; " +
    "otherwise set TRUST_PROXY=false to silence this."
  );
}
