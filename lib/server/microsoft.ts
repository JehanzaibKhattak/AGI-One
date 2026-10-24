import { z } from "zod";
import { HttpError } from "./errors";
export const microsoftScopes =
  "offline_access User.Read Mail.ReadBasic Calendars.ReadBasic";
const credentialSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().max(86400),
  scope: z.string(),
});
export type MicrosoftCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
export function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID,
    clientSecret = process.env.MICROSOFT_CLIENT_SECRET,
    base = process.env.BETTER_AUTH_URL;
  const encryption = Buffer.from(
    process.env.CONNECTION_ENCRYPTION_KEY || "",
    "base64",
  );
  if (!clientId || !clientSecret || !base || encryption.length !== 32)
    throw new HttpError(
      503,
      "Microsoft 365 setup is required. Ask the workspace administrator to follow the connection setup guide.",
    );
  const tenant = process.env.MICROSOFT_TENANT_ID || "organizations";
  if (!/^[a-zA-Z0-9.-]+$/.test(tenant))
    throw new HttpError(503, "Invalid Microsoft tenant configuration.");
  return {
    clientId,
    clientSecret,
    redirectUri: new URL("/api/connections/microsoft/callback", base).href,
    authority: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`,
  };
}
export function microsoftConfigured() {
  try {
    microsoftConfig();
    return true;
  } catch {
    return false;
  }
}
export async function exchangeToken(
  parameters: Record<string, string>,
  previousRefresh?: string,
): Promise<MicrosoftCredentials> {
  const config = microsoftConfig();
  const response = await fetch(config.authority + "/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...parameters,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: microsoftScopes,
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "Microsoft authorization expired or was declined. Reconnect your account.",
    );
  const token = credentialSchema.safeParse(await response.json());
  if (!token.success)
    throw new HttpError(
      502,
      "Microsoft returned an invalid authorization response.",
    );
  const granted = new Set(token.data.scope.toLowerCase().split(" "));
  if (
    !["user.read", "mail.readbasic", "calendars.readbasic"].every((s) =>
      granted.has(s),
    )
  )
    throw new HttpError(
      400,
      "The required read-only permissions were not granted.",
    );
  const refreshToken = token.data.refresh_token || previousRefresh;
  if (!refreshToken)
    throw new HttpError(
      400,
      "Microsoft did not grant offline access. Reconnect and approve the requested permissions.",
    );
  return {
    accessToken: token.data.access_token,
    refreshToken,
    expiresAt: Date.now() + token.data.expires_in * 1000,
  };
}
export async function graphGet(token: string, path: string) {
  // Only fixed Microsoft Graph paths supplied by this module's callers are allowed.
  if (!path.startsWith("/me")) throw new Error("Invalid Microsoft Graph path.");
  const r = await fetch("https://graph.microsoft.com/v1.0" + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new HttpError(
      r.status === 429 ? 429 : 502,
      r.status === 429
        ? "Microsoft is limiting requests. Try again shortly."
        : "Microsoft 365 could not be read. Reconnect your account or try again.",
    );
  return r.json();
}
const safeLink = z
  .string()
  .url()
  .refine((v) => new URL(v).protocol === "https:")
  .catch("");
export const profileSchema = z.object({
  displayName: z.string().max(500),
  mail: z.string().nullable().optional(),
  userPrincipalName: z.string().optional(),
});
export const mailSchema = z.object({
  value: z
    .array(
      z.object({
        id: z.string(),
        subject: z.string().max(2000).nullable().optional(),
        receivedDateTime: z.string(),
        from: z
          .object({
            emailAddress: z.object({
              name: z.string().nullable().optional(),
              address: z.string(),
            }),
          })
          .optional(),
        webLink: safeLink,
      }),
    )
    .max(25),
});
export const calendarSchema = z.object({
  value: z
    .array(
      z.object({
        id: z.string(),
        subject: z.string().max(2000).nullable().optional(),
        start: z.object({ dateTime: z.string(), timeZone: z.string() }),
        end: z.object({ dateTime: z.string(), timeZone: z.string() }),
        webLink: safeLink,
      }),
    )
    .max(25),
});
