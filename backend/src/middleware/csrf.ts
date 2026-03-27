import { doubleCsrf } from "csrf-csrf";
import { config } from "../config";

export const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.SESSION_SECRET,
  getSessionIdentifier: (req) => req.sessionID ?? "",
  cookieName: "x-csrf-token",
  cookieOptions: {
    sameSite: "strict",
    path: "/",
    secure: config.NODE_ENV === "production",
    httpOnly: true,
  },
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"] as string,
});
