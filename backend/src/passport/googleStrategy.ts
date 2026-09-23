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
        // Without `state`, passport-oauth2 installs a NullStore whose verify() always passes —
        // i.e. no CSRF protection on the callback (RFC 6749 §10.12). `pkce` additionally binds
        // the authorization code to this request; it requires `state`, or the constructor throws.
        // Both keep their handle in the session, so the session cookie must reach the callback:
        // don't tighten the cookie to sameSite=strict, which would drop it on the provider's
        // top-level redirect back.
        state: true,
        pkce: true,
        passReqToCallback: true,
      },
      async (req: Request, _accessToken: string, _refreshToken: string, profile: Profile, done: VerifyDone) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const result = await findOrCreateUser(
            { sub: profile.id, provider: "google", name: profile.displayName, email },
            req.session.inviteToken
          );
          if (!result) return done(null, false);
          delete req.session.inviteToken;
          req.inviteOutcome = result.outcome;
          done(null, result.user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
