import passport from "passport";
// @ts-expect-error - no official types for passport-microsoft
import MicrosoftStrategyPkg from "passport-microsoft";
interface MicrosoftStrategyConstructor { new (options: unknown, verify: unknown): passport.Strategy }
const MicrosoftStrategy = (MicrosoftStrategyPkg as { Strategy?: MicrosoftStrategyConstructor }).Strategy ?? MicrosoftStrategyPkg as MicrosoftStrategyConstructor;
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";

type VerifyDone = (err: unknown, user?: Express.User | false) => void;
interface MicrosoftProfile {
  id: string;
  displayName: string;
  emails?: { value: string }[];
  _json?: { mail?: string; userPrincipalName?: string };
}

export function setupMicrosoftStrategy() {
  if (!config.MICROSOFT_CLIENT_ID || !config.MICROSOFT_CLIENT_SECRET) return;

  passport.use(
    new MicrosoftStrategy(
      {
        clientID: config.MICROSOFT_CLIENT_ID,
        clientSecret: config.MICROSOFT_CLIENT_SECRET,
        callbackURL: config.MICROSOFT_CALLBACK_URL ?? "/auth/microsoft/callback",
        tenant: config.MICROSOFT_TENANT_ID,
        scope: ["user.read"],
        // See googleStrategy for why these are set. passport-microsoft is a thin wrapper that
        // forwards its options straight to passport-oauth2, so both take effect here.
        state: true,
        pkce: true,
        passReqToCallback: true,
      },
      async (req: Request, _accessToken: string, _refreshToken: string, profile: MicrosoftProfile, done: VerifyDone) => {
        try {
          const email = profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName ?? "";
          // Consume the staged token up front, whatever happens next. If it survived a failed
          // redemption (invite already used, revoked or expired) every later sign-in from this
          // browser would take the invite branch again and fail the same way, locking the user out
          // of an otherwise valid login with no way to diagnose it.
          const inviteToken = req.session.inviteToken;
          delete req.session.inviteToken;
          const result = await findOrCreateUser(
            { sub: profile.id, provider: "microsoft", name: profile.displayName, email },
            inviteToken
          );
          if (!result) return done(null, false);
          req.inviteOutcome = result.outcome;
          done(null, result.user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}
