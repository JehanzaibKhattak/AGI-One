# Account verification, recovery and MFA

AGI One requires verified email before workspace creation, invitation acceptance or workspace access. Existing unverified accounts must verify too; their business data is retained. No migration marks addresses verified automatically. Verification links expire after one hour and do not create a session: users must sign in, including their second factor when enabled. Invitation continuation is preserved through verification.

## Local development: free email preview

The example configuration explicitly sets `AUTH_MAIL_MODE=preview`. This mode is permitted only when `BETTER_AUTH_URL` uses `localhost`, `127.0.0.1` or `[::1]`. Messages are written as JSON files into the operating system's temporary directory under `agi-one-mail` (for example `/private/var/folders/.../T/agi-one-mail` on macOS, `/tmp/agi-one-mail` on Linux). The directory must be owned by the server user and has mode 0700; files use 0600. There is no HTTP inbox endpoint and no emails are sent.

To locate the folder, run:

```sh
node -e 'console.log(require("node:path").join(require("node:os").tmpdir(), "agi-one-mail"))'
```

After signing up, privately open the newest file addressed to your test email and follow the verification URL in its `text` field. Sign in afterward. The same folder receives password-reset previews. Treat these files as credentials; do not commit or share them. Remove old previews when the local test work is finished. Preview files are not an application email archive.

## Deployed environments: SMTP

Configure a real transactional SMTP service and a sender authorized by your domain:

```dotenv
AUTH_MAIL_MODE=smtp
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_FROM=AGI One <accounts@your-domain.example>
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

Port 465 uses implicit TLS; other ports require STARTTLS. Certificate checks are enabled. Credentials are server-only and SMTP debug/message logging is disabled. IP-authorized relays can omit both username and password; configuring only one is rejected. Public deployments cannot use preview mode. Configure the sender's SPF/DKIM/DMARC and verify actual inbox/spam delivery with your provider before inviting real clients.

Mail delivery is awaited. Failure is reported; it is not treated as successful delivery. A user whose initial verification message fails can request another link from **Verify your email**. Durable retry queues, bounce processing and email-delivery monitoring remain production work. Never put SMTP credentials into Git or chat.

## Recovery and sessions

**Forgot your password?** sends a 30-minute recovery link and displays a generic response for unknown addresses. Reset tokens are single-use. A completed reset revokes all account sessions, pending MFA challenges, trusted-device records and outstanding recovery tokens, and leaves MFA enabled. PostgreSQL triggers enforce invalidation atomically with password or MFA changes. An attacker with email access alone cannot use password reset to disable an existing second factor. There is no administrator MFA-reset shortcut.

**Account security** is available to every workspace member, including viewers. Users can change their password with their current password, list active devices, revoke a specific other session or sign out other sessions. Password changes revoke existing sessions; the normal password-change UI then receives a fresh current session. MFA enable/disable rotates the current session and revokes other sessions. Security changes produce metadata-only workspace audit events; passwords, TOTP secrets, backup codes and recovery tokens are never included in those events.

## Authenticator and backup codes

1. Open **Account security** and enter your current password.
2. Choose **Set up authenticator**. Add the displayed setup key as a time-based account in your authenticator app, or use the `otpauth` link on a device that supports it.
3. Enter the six-digit authenticator code. MFA becomes active only after successful verification.
4. Save the ten backup codes in your password manager. Each works once. The UI clears the codes when you dismiss them or leave the page. Replacing the set requires your password and invalidates the previous set.

Sign-in with an MFA-enabled account creates a pending challenge, not workspace access. Users must verify an authenticator or unused backup code. No trusted-device bypass is offered by this UI. Better Auth encrypts authenticator secrets and backup codes using the server auth secret; keep that secret stable and backed up securely. Losing both the authenticator and all backup codes requires a separately designed identity-recovery process; password reset alone deliberately cannot remove MFA.

Sign-in/signup are rate-limited to five attempts per minute; recovery/resend requests to three per minute. Second-factor verification also has rate limits and an account lockout after ten failed attempts for fifteen minutes. Limits use PostgreSQL shared state; tests honor rate-limit retry delays. Clock synchronization is required for TOTP.

## Verification and remaining gates

Automated checks exercise actual local email previews, verified signup/invitation acceptance, workspace denial before verification, MFA enrollment and login, backup-code reuse rejection, password reset, session invalidation and security audit events. Production SMTP deliverability, enterprise SSO, organization-enforced MFA, audited lost-factor recovery, key rotation and independent security review remain open gates. This implementation is not a security certification.

Primary references: [Better Auth email/password options](https://better-auth.com/docs/authentication/email-password), [two-factor authentication](https://better-auth.com/docs/plugins/2fa), [Nodemailer SMTP](https://nodemailer.com/smtp).
