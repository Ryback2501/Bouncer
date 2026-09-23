import passport from "passport";
import { Strategy as OpenIDConnectStrategy, VerifyCallback } from "passport-openidconnect";
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";

export function setupLinkedInStrategy() {
  if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) return;

  // No `nonce` here, deliberately. Unlike passport-oauth2, passport-openidconnect always installs
  // a session state store, so this flow already sends and verifies `state` — the CSRF protection
  // the OAuth 2.0 strategies were missing. Requesting a nonce additionally requires the provider
  // to echo it back in the ID token, or lib/strategy.js:195 fails the login outright — and
  // LinkedIn does not echo it. Verified against real sign-ins: with `nonce: true` the callback
  // reached ID-token validation and bounced to ?error=auth_failed every time; without it the same
  // account completed the flow. Do not re-add it without re-testing a live LinkedIn login.
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
            { sub: profile.id, provider: "linkedin", name: profile.displayName ?? "", email },
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
