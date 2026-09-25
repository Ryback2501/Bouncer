import { doubleCsrf } from "csrf-csrf";
import { config } from "../config";
import { isHttpsOrigin } from "../lib/securityPolicy";

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.SESSION_SECRET,
  getSessionIdentifier: (req) => req.sessionID ?? "",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "strict",
    path: "/",
    secure: isHttpsOrigin(config.FRONTEND_URL),
    httpOnly: true,
  },
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"] as string,
});
