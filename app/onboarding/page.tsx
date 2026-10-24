import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { pool } from "@/lib/server/db";
import { WorkspaceOnboarding } from "@/components/forms/workspace-onboarding";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const { invitation } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const next =
      "/onboarding" +
      (invitation ? "?invitation=" + encodeURIComponent(invitation) : "");
    redirect("/login?next=" + encodeURIComponent(next));
  }
  if (
    (
      await pool.query("SELECT 1 FROM agi_members WHERE user_id=$1", [
        session.user.id,
      ])
    ).rowCount
  )
    redirect("/dashboard");
  return <WorkspaceOnboarding invitation={invitation} />;
}
