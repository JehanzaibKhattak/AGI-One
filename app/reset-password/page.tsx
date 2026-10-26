import { AccountAccess } from "@/components/forms/account-access";
export const metadata = {
  title: "Reset password",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const q = await searchParams;
  return (
    <AccountAccess mode="reset" token={q.token} invalid={Boolean(q.error)} />
  );
}
