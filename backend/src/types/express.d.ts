import { User as PrismaUser, Application as PrismaApplication } from "@prisma/client";

declare global {
  namespace Express {
    interface User extends PrismaUser {}
    interface Request {
      bouncerApp?: PrismaApplication;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    inviteToken?: string;
  }
}
