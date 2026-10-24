import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "@/lib/server/db";
import {
  requireMember,
  sameOrigin,
  readBody,
  errorResponse,
  HttpError,
} from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const rows = await pool.query(
      'SELECT u.id,u.name,u.email,m.role FROM agi_members m JOIN "user" u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.name',
      [member.workspace_id],
    );
    return Response.json(rows.rows, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const member = await requireMember(request);
    if (member.role !== "owner")
      throw new HttpError(403, "Only the owner can invite teammates.");
    const body = z
      .object({ email: z.email(), role: z.enum(["editor", "viewer"]) })
      .parse(await readBody(request));
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO agi_invitations(token_hash,workspace_id,email,role) VALUES($1,$2,$3,$4)",
      [
        createHash("sha256").update(token).digest("hex"),
        member.workspace_id,
        body.email.toLowerCase(),
        body.role,
      ],
    );
    const url = new URL("/onboarding", process.env.BETTER_AUTH_URL);
    url.searchParams.set("invitation", token);
    return Response.json({ url: url.toString() }, { status: 201 });
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? new HttpError(400, "Choose an email and role.")
        : error,
    );
  }
}
