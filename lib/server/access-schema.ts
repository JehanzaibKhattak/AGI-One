import { z } from "zod";
import { areas, actions, type Grants } from "@/lib/access";
import type { PoolClient } from "pg";
import { HttpError } from "./errors";
export const grantsSchema = z
  .record(z.string(), z.array(z.enum(actions)).max(actions.length))
  .refine(
    (grants) =>
      Object.keys(grants).every((key) =>
        areas.includes(key as (typeof areas)[number]),
      ) &&
      Object.values(grants).every(
        (list) => !list.length || list.includes("view"),
      ),
    "Every enabled module needs view access.",
  )
  .transform((value) => value as Grants);
export const scopeSchema = z.object({
  role: z.enum(["editor", "viewer"]),
  grants: grantsSchema.default({}),
  branch_ids: z.array(z.string().min(1).max(200)).max(100).default([]),
});
export async function validateBranches(
  client: PoolClient,
  workspaceId: string,
  ids: string[],
) {
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, "Duplicate branch selection.");
  if (!ids.length) return;
  const result = await client.query(
    "SELECT id FROM agi_branches WHERE workspace_id=$1 AND id=ANY($2::text[])",
    [workspaceId, ids],
  );
  if (result.rowCount !== ids.length)
    throw new HttpError(
      400,
      "A selected branch does not belong to this workspace.",
    );
}
export async function auditAdmin(
  client: PoolClient,
  workspaceId: string,
  userId: string,
  action: string,
  detail: unknown,
) {
  await client.query(
    "INSERT INTO agi_events(id,workspace_id,user_id,action,detail) VALUES($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), workspaceId, userId, action, JSON.stringify(detail)],
  );
}
