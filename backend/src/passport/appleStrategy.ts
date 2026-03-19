import passport from "passport";
import AppleStrategy from "passport-apple";
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";
import { readFileSync } from "fs";

type VerifyDone = (err: unknown, user?: Express.User | false) => void;
interface AppleProfile {
  id: string;
  email?: string;
  name?: { firstName?: string; lastName?: string };
}

export function setupAppleStrategy() {
  if (
    !config.APPLE_CLIENT_ID ||
    !config.APPLE_TEAM_ID ||
    !config.APPLE_KEY_ID ||
    !config.APPLE_PRIVATE_KEY_PATH
  )
    return;

  passport.use(
    new AppleStrategy(
      {
        clientID: config.APPLE_CLIENT_ID,
        teamID: config.APPLE_TEAM_ID,
        keyID: config.APPLE_KEY_ID,
        privateKeyString: readFileSync(config.APPLE_PRIVATE_KEY_PATH, "utf8"),
        callbackURL: config.APPLE_CALLBACK_URL ?? "/auth/apple/callback",
        scope: ["name", "email"],
        passReqToCallback: true,
      },
      async (req: Request, _accessToken: string, _refreshToken: string, _idToken: object, profile: AppleProfile, done: VerifyDone) => {
        try {
          const email = profile.email ?? "";
          const name = profile.name
            ? `${profile.name.firstName ?? ""} ${profile.name.lastName ?? ""}`.trim()
            : email;
          const user = await findOrCreateUser(
            { sub: `apple:${profile.id}`, provider: "apple", name: name || email, email },
            req.session.inviteToken
          );
          if (user) delete req.session.inviteToken;
          if (!user) return done(null, false);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
