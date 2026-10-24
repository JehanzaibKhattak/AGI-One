import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ModulePage } from "@/components/modules/module-page";
import { DetailPage } from "@/components/modules/detail-page";
import { DocumentEditor } from "@/components/modules/document-editor";
import { Accounts, Receivables } from "@/components/modules/finance";
import { Reports } from "@/components/modules/reports";
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
      route === "/dashboard"
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
  if (route === "/dashboard") return <Dashboard />;
  if (route === "/reports") return <Reports />;
  if (route === "/settings") return <Settings />;
  if (route === "/finance/accounts") return <Accounts />;
  if (route === "/finance/receivables") return <Receivables />;
  if (route === "/crm/overview" || route === "/crm/organizations")
    return <ModulePage module={moduleFor("organizations")} />;
  if (route.startsWith("/crm/customers/"))
    return <DetailPage module={moduleFor("organizations")} id={path[2]} />;
  if (route.startsWith("/inventory/products/"))
    return <DetailPage module={moduleFor("products")} id={path[2]} />;
  const config = modules
    .filter((m) => route === m.path || route.startsWith(m.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!config) notFound();
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
