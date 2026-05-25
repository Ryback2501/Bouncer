// A requested redirect URI is allowed only if its origin matches the origin of one of the
// application's registered redirect URIs. Matching by origin (not exact URL) lets an app send
// users to any path on a domain it controls, while preventing open redirects to other domains.
export function isAllowedRedirectUri(requested: string, allowed: string[]): boolean {
  let requestedOrigin: string;
  try {
    requestedOrigin = new URL(requested).origin;
  } catch {
    return false;
  }
  return allowed.some((entry) => {
    try {
      return new URL(entry).origin === requestedOrigin;
    } catch {
      return false;
    }
  });
}
