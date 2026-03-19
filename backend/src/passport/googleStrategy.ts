import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config";
import { findOrCreateUser } from "./index";

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
      async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const user = await findOrCreateUser(
            { sub: `google:${profile.id}`, provider: "google", name: profile.displayName, email },
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
