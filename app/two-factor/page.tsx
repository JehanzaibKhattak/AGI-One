import { AccountAccess } from "@/components/forms/account-access";
import { authDestination } from "@/lib/auth-navigation";
export const metadata = {
  title: "Verify sign-in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const q = await searchParams;
  return <AccountAccess mode="two-factor" next={authDestination(q.next)} />;
}
