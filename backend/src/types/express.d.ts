import { User as PrismaUser, Application as PrismaApplication } from "@prisma/client";

declare global {
  namespace Express {
    interface User extends PrismaUser { [key: string]: unknown }
    interface Request {
      bouncerApp?: PrismaApplication;
      // Set by the OAuth verify step, read by the callback handler to decide how to finish:
      // admin invites/logins keep a portal session; app invites are logged out + redirected.
      // Lives on the request (not the session) so it survives passport's session regeneration
      // on login (the session-fixation defense in passport ≥0.6).
      inviteOutcome?: { kind: "admin" | "app"; redirectUri: string | null; appCustomId: string };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    inviteToken?: string;
  }
}
