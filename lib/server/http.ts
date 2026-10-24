import { auth } from "./auth";
import { pool } from "./db";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "Sign in to continue.");
  return session;
}
export async function requireMember(request: Request) {
  const session = await requireSession(request);
  const result = await pool.query<{
    workspace_id: string;
    role: "owner" | "editor" | "viewer";
  }>("SELECT workspace_id, role FROM agi_members WHERE user_id=$1", [
    session.user.id,
  ]);
  if (!result.rows[0])
    throw new HttpError(403, "Create or join a workspace first.");
  return { ...result.rows[0], user: session.user };
}
export function sameOrigin(request: Request) {
  const expected = process.env.BETTER_AUTH_URL;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function readBody(request: Request) {
  const maximum = 1_000_000;
  if (Number(request.headers.get("content-length")) > maximum)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  const decoder = new TextDecoder();
  let length = 0;
  let raw = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large.");
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "AGI One request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    {
      error:
        "The request could not be completed. Try again or contact your administrator.",
    },
    { status: 500 },
  );
}
