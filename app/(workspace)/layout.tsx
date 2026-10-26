import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/server/auth";
import { pool } from "@/lib/server/db";
import { Shell } from "@/components/layout/shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.emailVerified) redirect("/verify-email");
  const member = await pool.query(
    "SELECT 1 FROM agi_members WHERE user_id=$1",
    [session.user.id],
  );
  if (!member.rowCount) redirect("/onboarding");
  return <Shell>{children}</Shell>;
}
