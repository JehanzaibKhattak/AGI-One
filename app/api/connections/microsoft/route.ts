import { randomBytes, createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/lib/server/db";
import {
  requireMember,
  sameOrigin,
  errorResponse,
  HttpError,
} from "@/lib/server/http";
import { requirePermission } from "@/lib/server/authorization";
import { seal, unseal } from "@/lib/server/connection-crypto";
import {
  microsoftConfig,
  microsoftConfigured,
  microsoftScopes,
  exchangeToken,
  graphGet,
  mailSchema,
  calendarSchema,
  type MicrosoftCredentials,
} from "@/lib/server/microsoft";
async function scoped(request: Request, mutate = false) {
  if (mutate) sameOrigin(request);
  const member = await requireMember(request);
  requirePermission(member, "sales", "view");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const current = (
      await client.query(
        "SELECT role,grants,branch_ids FROM agi_members WHERE workspace_id=$1 AND user_id=$2 FOR SHARE",
        [member.workspace_id, member.user.id],
      )
    ).rows[0];
    if (!current)
      throw new HttpError(403, "Your workspace access has been removed.");
    requirePermission(current, "sales", "view");
    return {
      member,
      client,
      context: `microsoft:${member.workspace_id}:${member.user.id}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    throw error;
  }
}
export async function GET(request: Request) {
  let client: PoolClient | undefined;
  try {
    const scopedResult = await scoped(request);
    client = scopedResult.client;
    const { member, context } = scopedResult;
    const connection = (
      await client.query(
        "SELECT account_label,credentials FROM agi_connections WHERE workspace_id=$1 AND user_id=$2 AND provider='microsoft' FOR UPDATE",
        [member.workspace_id, member.user.id],
      )
    ).rows[0];
    if (!connection) {
      await client.query("COMMIT");
      return Response.json(
        { configured: microsoftConfigured(), connected: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (new URL(request.url).searchParams.get("read") !== "1") {
      await client.query("COMMIT");
      return Response.json(
        {
          configured: microsoftConfigured(),
          connected: true,
          account: connection.account_label,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    let credentials = JSON.parse(
      unseal(connection.credentials, context),
    ) as MicrosoftCredentials;
    if (credentials.expiresAt < Date.now() + 60000) {
      credentials = await exchangeToken(
        {
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
        },
        credentials.refreshToken,
      );
      await client.query(
        "UPDATE agi_connections SET credentials=$1,updated_at=now() WHERE workspace_id=$2 AND user_id=$3 AND provider='microsoft'",
        [
          seal(JSON.stringify(credentials), context),
          member.workspace_id,
          member.user.id,
        ],
      );
    }
    const start = new Date().toISOString(),
      end = new Date(Date.now() + 14 * 86400000).toISOString();
    const [mail, calendar] = await Promise.all([
      graphGet(
        credentials.accessToken,
        "/me/mailFolders/inbox/messages?" +
          new URLSearchParams({
            $top: "20",
            $select: "id,subject,receivedDateTime,from,webLink",
            $orderby: "receivedDateTime desc",
          }),
      ).then((data) => mailSchema.parse(data)),
      graphGet(
        credentials.accessToken,
        "/me/calendarView?" +
          new URLSearchParams({
            startDateTime: start,
            endDateTime: end,
            $top: "20",
            $select: "id,subject,start,end,webLink",
            $orderby: "start/dateTime",
          }),
      ).then((data) => calendarSchema.parse(data)),
    ]);
    await client.query("COMMIT");
    return Response.json(
      {
        configured: true,
        connected: true,
        account: connection.account_label,
        messages: mail.value,
        events: calendar.value,
        readAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(error);
  } finally {
    client?.release();
  }
}
export async function POST(request: Request) {
  let client: PoolClient | undefined;
  try {
    const result = await scoped(request, true);
    client = result.client;
    const { member, context } = result,
      config = microsoftConfig();
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(48).toString("base64url");
    await client.query(
      "DELETE FROM agi_connection_states WHERE expires_at<now() OR (workspace_id=$1 AND user_id=$2)",
      [member.workspace_id, member.user.id],
    );
    await client.query(
      "INSERT INTO agi_connection_states(state_hash,workspace_id,user_id,verifier) VALUES($1,$2,$3,$4)",
      [
        createHash("sha256").update(state).digest("hex"),
        member.workspace_id,
        member.user.id,
        seal(verifier, context + ":state"),
      ],
    );
    await client.query("COMMIT");
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      response_mode: "query",
      scope: microsoftScopes,
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return Response.json(
      { url: config.authority + "/authorize?" + params },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(error);
  } finally {
    client?.release();
  }
}
export async function DELETE(request: Request) {
  let client: PoolClient | undefined;
  try {
    const result = await scoped(request, true);
    client = result.client;
    const { member } = result;
    await client.query(
      "DELETE FROM agi_connections WHERE workspace_id=$1 AND user_id=$2 AND provider='microsoft'",
      [member.workspace_id, member.user.id],
    );
    await client.query(
      "DELETE FROM agi_connection_states WHERE workspace_id=$1 AND user_id=$2",
      [member.workspace_id, member.user.id],
    );
    await client.query(
      "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) VALUES($1,$2,$3,'connection.disconnected',$4)",
      [
        randomUUID(),
        member.workspace_id,
        member.user.id,
        JSON.stringify({ provider: "microsoft" }),
      ],
    );
    await client.query("COMMIT");
    return Response.json({ ok: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    return errorResponse(error);
  } finally {
    client?.release();
  }
}
