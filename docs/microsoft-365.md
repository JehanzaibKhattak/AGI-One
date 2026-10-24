# Microsoft 365 connection

AGI One connects each signed-in workspace member to their own Microsoft work account. It uses the OAuth authorization code flow with PKCE and delegated `User.Read`, `Mail.ReadBasic`, `Calendars.ReadBasic`, and `offline_access` permissions. Organization consent policies may require administrator approval. No application-wide mailbox permission, sending, calendar writes, message bodies, or attachments are requested.

## Configure the application

1. Register a **Web** application in Microsoft Entra ID. Select the supported organizational account types appropriate to your customers. Use a single tenant ID for a private pilot, or `organizations` for an app registered for multiple organizational tenants.
2. Register the exact redirect URI: `https://YOUR-DOMAIN/api/connections/microsoft/callback`. For local development use `http://localhost:3000/api/connections/microsoft/callback`.
3. Add the delegated Microsoft Graph permissions listed above, then create a client secret. Complete your organization's consent/publisher requirements before a customer rollout.
4. Set these variables in the server environment or ignored `.env.local`:

   ```dotenv
   MICROSOFT_CLIENT_ID=your-application-client-id
   MICROSOFT_CLIENT_SECRET=your-client-secret
   MICROSOFT_TENANT_ID=organizations
   CONNECTION_ENCRYPTION_KEY=your-separate-base64-encoded-32-byte-key
   ```

   Generate the encryption key with `openssl rand -base64 32`. Store it in your deployment secret manager and back it up securely, separately from database backups. Never commit these values. Keep the key stable: replacing it makes stored connections unreadable; disconnect/reconnect accounts after an intentional key replacement. Versioned key rotation is still a release gate.

5. Run `npm run db:migrate`, restart the server, open **Email & calendar**, and select **Connect Microsoft 365**. Consent happens on Microsoft's site. No credentials should be entered into AGI One itself.

## Behavior and limits

The connection reads the latest 20 inbox message headers and the first 20 meetings in the coming 14 days when the user selects **Refresh email & calendar**. Outlook links open the original records. This is an on-demand personal view; it does not copy mailbox content into shared customer activities, send email, create invitations, run background synchronization, or follow pagination beyond those limits.

OAuth states expire after ten minutes, are single-use and tied to the initiating member/workspace. PKCE verifiers and tokens are encrypted using AES-256-GCM with workspace/user/purpose binding. Refresh tokens rotate server-side. API responses never return credentials. Connection and OAuth-state rows have workspace row policies and membership foreign keys; revoking membership deletes stored credentials automatically. Disconnect deletes AGI One's credentials; revoke consent in Microsoft as well if needed.

Live consent and mailbox behavior require a real app registration and test tenant. Automated tests cover encryption/tamper isolation, scope validation, token refresh with mocked Microsoft responses, disabled configuration, callback rejection, and per-user access; those tests do not certify Microsoft's live consent process.

Primary references: [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference), [list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0), [calendar view](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0).
