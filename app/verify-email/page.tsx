import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { AccountAccess } from "@/components/forms/account-access";
import { authDestination } from "@/lib/auth-navigation";
export const metadata = {
  title: "Verify your email",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const q = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <AccountAccess
      mode="verify"
      email={session?.user.email || q.email}
      next={authDestination(q.next)}
    />
  );
}
