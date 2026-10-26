import { AccountSecurity } from "@/components/modules/account-security";
import { Connections } from "@/components/modules/connections";
import {
  SalesDirectory,
  Pipelines,
  SalesForecast,
} from "@/components/modules/sales";
import { headers } from "next/headers";
import { auth } from "@/lib/server/auth";
import { pool } from "@/lib/server/db";
import { can, areaForPath } from "@/lib/access";
import { Empty } from "@/components/common/ui";
import { AuditTrail } from "@/components/modules/audit";
import { CustomerDirectory } from "@/components/modules/customer-directory";
import { notFound, redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ModulePage } from "@/components/modules/module-page";
import { DetailPage } from "@/components/modules/detail-page";
import { DocumentEditor } from "@/components/modules/document-editor";
import { Accounts, Receivables } from "@/components/modules/finance";
import { Reports } from "@/components/modules/reports";
import { Team } from "@/components/modules/team";
import { Settings } from "@/components/modules/settings";
import { modules, moduleFor } from "@/lib/constants/modules";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const route = "/" + path.join("/");
  const config = modules
    .filter((m) => route === m.path || route.startsWith(m.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return {
    title:
      route === "/account/security"
        ? "Account security"
        : route === "/dashboard"
          ? "Dashboard"
          : route === "/reports"
            ? "Reports"
            : route === "/settings"
              ? "Settings"
              : config?.title || "Workspace",
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { path } = await params;
  const route = "/" + path.join("/");
  const area = areaForPath(route);
  if (area || route === "/approvals") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
    const member = (
      await pool.query(
        "SELECT role,grants,branch_ids FROM agi_members WHERE user_id=$1",
        [session.user.id],
      )
    ).rows[0];
    if (
      !member ||
      !(area
        ? can(member, area, "view")
        : can(member, "finance", "view") || can(member, "procurement", "view"))
    )
      return (
        <Empty
          title="Access restricted"
          description="Your workspace owner can adjust your module access."
        />
      );
  }
  if (route === "/account/security") return <AccountSecurity />;
  if (route === "/sales/connections") return <Connections />;
  if (route === "/sales/leads") return <SalesDirectory kind="leads" />;
  if (route === "/sales/tasks") return <SalesDirectory kind="tasks" />;
  if (route === "/sales/opportunities")
    return <SalesDirectory kind="opportunities" />;
  if (route === "/sales/pipelines") return <Pipelines />;
  if (route === "/sales/forecast") return <SalesForecast />;
  if (route === "/dashboard") return <Dashboard />;
  if (route === "/reports") return <Reports />;
  if (route === "/settings") return <Settings />;
  if (route === "/settings/users") return <Team />;
  if (route === "/settings/audit-log") return <AuditTrail />;
  if (route === "/finance/accounts") return <Accounts />;
  if (route === "/finance/receivables") return <Receivables />;
  if (route === "/crm/overview" || route === "/crm/organizations")
    return <CustomerDirectory />;
  if (route.startsWith("/crm/customers/"))
    return <DetailPage module={moduleFor("organizations")} id={path[2]} />;
  if (route.startsWith("/inventory/products/"))
    return <DetailPage module={moduleFor("products")} id={path[2]} />;
  const config = modules
    .filter((m) => route === m.path || route.startsWith(m.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!config) notFound();
  if (route === "/crm") return <CustomerDirectory />;
  if (route === config.path)
    return <ModulePage key={config.key} module={config} />;
  const suffix = route.slice(config.path.length + 1).split("/");
  if (
    ["quotations", "invoices", "purchaseOrders"].includes(config.key) &&
    (suffix[0] === "new" || suffix[1] === "edit")
  ) {
    const { customer } = await searchParams;
    return (
      <DocumentEditor
        key={route}
        kind={config.key as "quotations" | "invoices" | "purchaseOrders"}
        id={suffix[0] === "new" ? undefined : suffix[0]}
        customerId={customer}
      />
    );
  }
  if (suffix.length === 1 && suffix[0] !== "new")
    return <DetailPage key={route} module={config} id={suffix[0]} />;
  notFound();
}
