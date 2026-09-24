// Request URLs reach the log (pino-http serializes `req.url` and `req.query`) and the error handler.
// Some of them carry credentials, so the values are blanked before anything is written.
//
// Parameter *names* and non-secret values are deliberately preserved: a log line with no URL is
// useless for debugging, and the shape of a request is what makes one worth keeping.
//
// Invitation tokens no longer travel in URLs at all — the invite link carries them in the fragment,
// which a browser never transmits, and the preview endpoint takes them in the request body. The
// path rule below is a backstop for links minted before that change, and for anyone who reintroduces
// a token-bearing URL later.

const REDACTED = "[redacted]";

// `code_challenge` is intentionally absent: it is a hash, public by design, and useful when
// debugging PKCE.
const SENSITIVE_PARAMS = new Set(["invite", "code", "state", "nonce"]);

// Matches a token segment after /invite or /auth/invite. Deliberately keyed to the token's shape
// (invitationService mints 32 random bytes as hex) rather than "any segment", so sibling routes such
// as /auth/invite/stage stay readable in the log instead of being masked into indistinguishability.
const INVITE_PATH = /^(\/(?:auth\/)?invite)\/[0-9a-fA-F]{32,}/;

/** Blank the values of credential-bearing query parameters, keeping their names. */
export function redactQuery<T extends Record<string, unknown>>(query: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    out[key] = SENSITIVE_PARAMS.has(key) ? REDACTED : value;
  }
  return out;
}

/**
 * Strip credentials from a URL before it is logged. Accepts a relative URL (`req.url`) or an
 * absolute one (a `Location` header). Never throws — a logger must not be able to break a request.
 */
export function redactUrl(url: string): string {
  if (!url) return url;

  try {
    // A base is needed to parse a relative URL; it is discarded again below.
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
    const parsed = new URL(url, isAbsolute ? undefined : "http://localhost");

    let changed = false;
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_PARAMS.has(key)) {
        parsed.searchParams.set(key, REDACTED);
        changed = true;
      }
    }

    const redactedPath = parsed.pathname.replace(INVITE_PATH, `$1/${REDACTED}`);
    if (redactedPath !== parsed.pathname) {
      parsed.pathname = redactedPath;
      changed = true;
    }
    if (!changed) return url;

    // URLSearchParams percent-encodes the brackets of the placeholder; put it back so the log reads
    // cleanly, and rebuild the relative form when that is what came in.
    const rebuilt = isAbsolute ? parsed.toString() : parsed.pathname + parsed.search + parsed.hash;
    return rebuilt.replace(/%5Bredacted%5D/gi, REDACTED);
  } catch {
    // Unparseable input: fall back to a blunt textual strip rather than risk leaking it.
    return url.replace(
      /\b(invite|code|state|nonce)=[^&\s]*/gi,
      (_m, key: string) => `${key}=${REDACTED}`
    );
  }
}
