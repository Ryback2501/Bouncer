import passport from "passport";
import { Strategy as GitHubStrategy, Profile } from "passport-github2";
import { Request } from "express";
import { config } from "../config";
import { findOrCreateUser } from "./index";

type VerifyDone = (err: unknown, user?: Express.User | false) => void;

export function setupGitHubStrategy() {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) return;

  passport.use(
    new GitHubStrategy(
      {
        clientID: config.GITHUB_CLIENT_ID,
        clientSecret: config.GITHUB_CLIENT_SECRET,
        callbackURL: config.GITHUB_CALLBACK_URL ?? "/auth/github/callback",
        scope: ["user:email"],
        passReqToCallback: true,
      },
      async (req: Request, _accessToken: string, _refreshToken: string, profile: Profile, done: VerifyDone) => {
        try {
          const email = profile.emails?.[0]?.value ?? "";
          const result = await findOrCreateUser(
            { sub: `github:${profile.id}`, provider: "github", name: profile.displayName || profile.username || email, email },
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
