import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "@/lib/server/db";
import { requireMember, HttpError } from "@/lib/server/http";
import { requirePermission } from "@/lib/server/authorization";
import { unseal, seal } from "@/lib/server/connection-crypto";
import {
  exchangeToken,
  graphGet,
  profileSchema,
  microsoftConfig,
} from "@/lib/server/microsoft";
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const member = await requireMember(request);
    requirePermission(member, "sales", "view");
    const q = z
      .object({
        state: z.string().min(40).max(100),
        code: z.string().min(1).max(10000),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    await client.query("BEGIN");
    await client.query("SELECT set_config('agi.workspace_id',$1,true)", [
      member.workspace_id,
    ]);
    const state = (
      await client.query(
        "DELETE FROM agi_connection_states WHERE state_hash=$1 AND workspace_id=$2 AND user_id=$3 AND expires_at>now() RETURNING verifier",
        [
          createHash("sha256").update(q.state).digest("hex"),
          member.workspace_id,
          member.user.id,
        ],
      )
    ).rows[0];
    if (!state)
      throw new HttpError(400, "Invalid or expired connection request.");
    await client.query("COMMIT");
    const context = `microsoft:${member.workspace_id}:${member.user.id}`,
      config = microsoftConfig();
    const credentials = await exchangeToken({
      grant_type: "authorization_code",
      code: q.code,
      redirect_uri: config.redirectUri,
      code_verifier: unseal(state.verifier, context + ":state"),
    });
    const profile = profileSchema.parse(
      await graphGet(
        credentials.accessToken,
        "/me?$select=displayName,mail,userPrincipalName",
      ),
    );
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
    if (!current) throw new HttpError(403, "Access removed.");
    requirePermission(current, "sales", "view");
    await client.query(
      "INSERT INTO agi_connections(workspace_id,user_id,provider,account_label,credentials) VALUES($1,$2,'microsoft',$3,$4) ON CONFLICT(workspace_id,user_id,provider) DO UPDATE SET account_label=excluded.account_label,credentials=excluded.credentials,updated_at=now()",
      [
        member.workspace_id,
        member.user.id,
        profile.mail || profile.userPrincipalName || profile.displayName,
        seal(JSON.stringify(credentials), context),
      ],
    );
    await client.query(
      "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) VALUES($1,$2,$3,'connection.connected',$4)",
      [
        randomUUID(),
        member.workspace_id,
        member.user.id,
        JSON.stringify({ provider: "microsoft" }),
      ],
    );
    await client.query("COMMIT");
    return Response.redirect(
      new URL("/sales/connections?connection=success", config.redirectUri),
      303,
    );
  } catch {
    await client.query("ROLLBACK");
    return Response.redirect(
      new URL(
        "/sales/connections?connection=failed",
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
      ),
      303,
    );
  } finally {
    client.release();
  }
}
