import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";

type VerifyDone = (err: unknown, user?: Express.User | false) => void;

export function setupGoogleStrategy() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: config.GOOGLE_CALLBACK_URL ?? "/auth/google/callback",
        scope: ["profile", "email"],
        passReqToCallback: true,
      },
      async (req: Request, _accessToken: string, _refreshToken: string, profile: Profile, done: VerifyDone) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const result = await findOrCreateUser(
            { sub: `google:${profile.id}`, provider: "google", name: profile.displayName, email },
            req.session.inviteToken
          );
          if (!result) return done(null, false);
          delete req.session.inviteToken;
          req.session.inviteOutcome = result.outcome;
          done(null, result.user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
