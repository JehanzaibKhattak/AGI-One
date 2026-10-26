import { createAuthMiddleware } from "better-auth/api";
import { randomUUID } from "node:crypto";
import { twoFactor } from "better-auth/plugins/two-factor";
import { mailConfiguration, sendAccountMail } from "./mail";
import { betterAuth } from "better-auth";
import { pool } from "./db";
if (
  !process.env.BETTER_AUTH_URL ||
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32
)
  throw new Error(
    "Set BETTER_AUTH_URL and a random BETTER_AUTH_SECRET of at least 32 characters.",
  );
mailConfiguration();
export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 1800,
    onPasswordReset: async ({ user }) => {
      await pool.query(
        "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) SELECT $1,workspace_id,user_id,'auth.password_reset','{}'::jsonb FROM agi_members WHERE user_id=$2",
        [randomUUID(), user.id],
      );
    },
    sendResetPassword: async ({ user, url }) =>
      sendAccountMail(
        user.email,
        "Reset your AGI One password",
        `A password reset was requested for your AGI One account. This link expires in 30 minutes.\n\n${url}\n\nIf you did not request this, ignore this email. Your password has not changed.`,
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) =>
      sendAccountMail(
        user.email,
        "Verify your AGI One email",
        `Verify your email address to use AGI One. This link expires in one hour.\n\n${url}\n\nIf you did not create this account, ignore this email.`,
      ),
  },
  plugins: [
    twoFactor({
      issuer: "AGI One",
      skipVerificationOnEnable: false,
      backupCodeOptions: { storeBackupCodes: "encrypted" },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 10,
        durationSeconds: 900,
      },
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (
        ![
          "/two-factor/verify-totp",
          "/two-factor/disable",
          "/change-password",
        ].includes(ctx.path)
      )
        return;
      const before = ctx.context.session,
        after = ctx.context.newSession;
      if (
        !before ||
        !after ||
        (ctx.path !== "/change-password" &&
          Boolean(before.user.twoFactorEnabled) ===
            Boolean(after.user.twoFactorEnabled))
      )
        return;
      await pool.query(
        "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) SELECT $1,workspace_id,user_id,$3,'{}'::jsonb FROM agi_members WHERE user_id=$2",
        [
          randomUUID(),
          after.user.id,
          ctx.path === "/change-password"
            ? "auth.password_changed"
            : after.user.twoFactorEnabled
              ? "auth.mfa_enabled"
              : "auth.mfa_disabled",
        ],
      );
    }),
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/two-factor/*": { window: 60, max: 10 },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
});
