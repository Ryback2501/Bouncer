import passport from "passport";
// @ts-ignore - no official types for passport-microsoft
import MicrosoftStrategyPkg from "passport-microsoft";
const MicrosoftStrategy = (MicrosoftStrategyPkg as any).Strategy ?? MicrosoftStrategyPkg;
import { config } from "../config";
import { findOrCreateUser } from "./index";

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
        passReqToCallback: true,
      },
      async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName ?? "";
          const user = await findOrCreateUser(
            { sub: `microsoft:${profile.id}`, provider: "microsoft", name: profile.displayName, email },
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
