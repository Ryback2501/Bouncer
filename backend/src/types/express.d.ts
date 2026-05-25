import { User as PrismaUser, Application as PrismaApplication } from "@prisma/client";

declare global {
  namespace Express {
    interface User extends PrismaUser { [key: string]: unknown }
    interface Request {
      bouncerApp?: PrismaApplication;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    inviteToken?: string;
    // Set by the OAuth verify step so the post-callback handler knows how to finish:
    // admin invites/logins keep a portal session; app invites are logged out + redirected.
    inviteOutcome?: { kind: "admin" | "app"; redirectUri: string | null; appCustomId: string };
  }
}
