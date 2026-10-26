import { AccountAccess } from "@/components/forms/account-access";
export const metadata = {
  title: "Account recovery",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountAccess mode="forgot" />;
}
