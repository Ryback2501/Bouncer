import passport from "passport";
import { Strategy as OpenIDConnectStrategy, VerifyCallback } from "passport-openidconnect";
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";

export function setupLinkedInStrategy() {
  if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) return;

  passport.use(
    "linkedin",
    new OpenIDConnectStrategy(
      {
        issuer: "https://www.linkedin.com/oauth",
        authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
        tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
        userInfoURL: "https://api.linkedin.com/v2/userinfo",
        clientID: config.LINKEDIN_CLIENT_ID,
        clientSecret: config.LINKEDIN_CLIENT_SECRET,
        callbackURL: config.LINKEDIN_CALLBACK_URL ?? "/auth/linkedin/callback",
        scope: ["openid", "profile", "email"],
        passReqToCallback: true,
      },
      async (req: Request, _issuer: string, profile: passport.Profile, done: VerifyCallback) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const result = await findOrCreateUser(
            { sub: `linkedin:${profile.id}`, provider: "linkedin", name: profile.displayName ?? "", email },
            req.session.inviteToken
          );
          if (!result) return done(null, false as unknown as Express.User);
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
