"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  FileText,
  ShoppingBag,
  Boxes,
  Warehouse,
  Truck,
  PackageCheck,
  Microscope,
  Wrench,
  CalendarDays,
  ShieldCheck,
  HardHat,
  Receipt,
  Wallet,
  CreditCard,
  Landmark,
  BookOpen,
  Trophy,
  ChartNoAxesCombined,
  Settings,
  History,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Bell,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  LogOut,
  Check,
  ArrowUpRight,
  Command,
  Menu as MenuIcon,
  CheckCheck,
} from "lucide-react";
import { Modal, Menu, MenuItem, Badge, Empty } from "@/components/common/ui";
import { useDatabase, DataProvider } from "@/lib/services/provider";
import { commit } from "@/lib/services/repository";
import {
  modules,
  moduleFor,
  displayRows,
  recordPath,
} from "@/lib/constants/modules";
import { RecordForm } from "@/components/forms/record-form";
import type { Collection } from "@/types";
import { Toaster } from "sonner";
const groups = [
  { label: "WORKSPACE", items: [["Dashboard", "/dashboard", LayoutDashboard]] },
  {
    label: "CUSTOMERS & SALES",
    items: [
      ["CRM overview", "/crm/overview", Building2],
      ["Organizations", "/crm", Building2],
      ["Contacts", "/crm/contacts", Users],
      ["Opportunities", "/sales/opportunities", Target],
      ["Quotations", "/sales/quotations", FileText],
      ["Sales orders", "/sales/orders", ShoppingBag],
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      ["Inventory", "/inventory", Boxes],
      ["Warehouses", "/inventory/warehouses", Warehouse],
      ["Procurement", "/procurement", PackageCheck],
      ["Purchase orders", "/procurement/orders", ShoppingBag],
      ["Deliveries", "/sales/deliveries", Truck],
    ],
  },
  {
    label: "SERVICE",
    items: [
      ["Equipment", "/service/equipment", Microscope],
      ["Service tickets", "/service/tickets", Wrench],
      ["Preventive maintenance", "/service/maintenance", CalendarDays],
      ["Service contracts", "/service/contracts", ShieldCheck],
      ["Engineers", "/service/engineers", HardHat],
    ],
  },
  {
    label: "FINANCE",
    items: [
      ["Invoices", "/finance/invoices", Receipt],
      ["Receipts", "/finance/receipts", Wallet],
      ["Expenses", "/finance/expenses", CreditCard],
      ["Accounts", "/finance/accounts", BookOpen],
      ["Banking", "/finance/banking", Landmark],
    ],
  },
  {
    label: "COMMERCIAL & ANALYTICS",
    items: [
      ["Tenders", "/tenders", Trophy],
      ["Reports", "/reports", ChartNoAxesCombined],
      ["Approvals", "/approvals", ShieldCheck],
    ],
  },
  {
    label: "SYSTEM",
    items: [
      ["Users & roles", "/settings/users", UserCog],
      ["Activity logs", "/settings/audit-log", History],
      ["Settings", "/settings", Settings],
    ],
  },
] as const;
const quickKeys: Collection[] = [
  "organizations",
  "contacts",
  "opportunities",
  "quotations",
  "orders",
  "purchaseOrders",
  "tickets",
  "invoices",
  "payments",
  "expenses",
];
function ShellInner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const db = useDatabase();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [category, setCategory] = useState("All");
  const [help, setHelp] = useState(false);
  const [create, setCreate] = useState<Collection | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("amss-session"))
      queueMicrotask(() => setAuthenticated(true));
    else router.replace("/login");
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  const openCreate = (key: Collection) => {
    if (["quotations", "invoices", "purchaseOrders"].includes(key))
      router.push(moduleFor(key).path + "/new");
    else setCreate(key);
  };
  const current = modules
    .filter((m) => path === m.path || path.startsWith(m.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  const title =
    path === "/dashboard"
      ? "Overview"
      : path === "/reports"
        ? "Reports"
        : path === "/settings"
          ? "Settings"
          : current?.title || "Workspace";
  const results = [
    "organizations",
    "equipment",
    "invoices",
    "products",
    "tickets",
    "quotations",
    "orders",
  ].flatMap((k) => {
    const key = k as Collection;
    return displayRows(db, key)
      .filter(
        (row) =>
          query &&
          Object.values(row)
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .slice(0, 5)
      .map((row) => ({ key, row }));
  });
  const nav = (
    <>
      <Link
        href="/dashboard"
        className="brand"
        onClick={() => setMobile(false)}
      >
        <span className="brand-icon">
          a<span>m</span>
        </span>
        <span className="brand-name">
          AMSS <b>One</b>
          <small>Business Operations</small>
        </span>
      </Link>
      <button
        className="workspace-picker"
        onClick={() => {
          router.push("/settings");
          setMobile(false);
        }}
      >
        <span className="workspace-avatar">AM</span>
        <span>
          AM Sales & Services<small>Pakistan workspace</small>
        </span>
        <ChevronDown size={14} />
      </button>
      <nav aria-label="Main navigation">
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(([label, href, Icon]) => (
              <Link
                key={href}
                title={collapsed ? label : undefined}
                className={`nav-link ${path === href || (href !== "/crm" && href !== "/inventory" && href !== "/procurement" && href !== "/settings" && path.startsWith(href + "/")) ? "selected" : ""}`}
                href={href}
                onClick={() => setMobile(false)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {label === "Service tickets" && (
                  <b className="nav-count">
                    {
                      db.tickets.filter(
                        (t) => !["Closed", "Resolved"].includes(t.status),
                      ).length
                    }
                  </b>
                )}
                {label === "Approvals" &&
                  db.approvals.some((a) => a.status === "Pending") && (
                    <i className="nav-dot" />
                  )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="live-dot" />
        <span>All systems operational</span>
        <button
          className="icon-btn"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>
    </>
  );
  if (!authenticated)
    return (
      <div className="workspace-loading">
        <div className="brand-icon">am</div>
        <p>Opening your workspace…</p>
      </div>
    );
  return (
    <div className={collapsed ? "app-shell collapsed" : "app-shell"}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">{nav}</aside>
      <Modal
        open={mobile}
        onOpenChange={setMobile}
        title="AMSS One navigation"
        drawer
      >
        <div className="mobile-nav">{nav}</div>
      </Modal>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <MenuIcon size={20} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
            {path.split("/").length > 3 && (
              <>
                <ChevronRight size={13} />
                <span>{path.endsWith("/new") ? "Create new" : "Details"}</span>
              </>
            )}
          </div>
          <div className="topbar-tools">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>
            <Menu
              className="btn primary quick-create"
              label={
                <>
                  <Plus size={16} />
                  <span>New</span>
                  <ChevronDown size={13} />
                </>
              }
            >
              {quickKeys.map((key) => (
                <MenuItem key={key} onClick={() => openCreate(key)}>
                  <Plus size={14} />
                  {key === "payments"
                    ? "Receive payment"
                    : `New ${moduleFor(key).singular.toLowerCase()}`}
                </MenuItem>
              ))}
            </Menu>
            <div className="top-divider" />
            <button
              className="icon-btn notification-btn"
              aria-label="Notifications"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {db.notifications.some((n) => !n.read) && <i />}
            </button>
            <button
              className="icon-btn help-button"
              aria-label="Help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <Menu
              className="profile-button"
              label={
                <>
                  <span className="avatar admin">AK</span>
                  <ChevronDown size={13} />
                </>
              }
            >
              <MenuItem onClick={() => router.push("/settings/users")}>
                Admin · Super Admin
              </MenuItem>
              <MenuItem onClick={() => router.push("/settings")}>
                Workspace settings
              </MenuItem>
              <MenuItem
                onClick={() => {
                  sessionStorage.removeItem("amss-session");
                  router.push("/login");
                }}
              >
                <LogOut size={15} />
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            AMSS One <span className="muted">/</span> Business, connected.
          </span>
          <span>
            Pakistan workspace <span className="live-dot" /> Demo environment
          </span>
        </footer>
      </div>
      <Modal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search your workspace"
        description="Search customer, invoice, quotation, serial number, product…"
      >
        <div className="command-search">
          <Search size={20} />
          <input
            autoFocus
            aria-label="Global search"
            placeholder="Try ST-1098 or STA Compact Max"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>esc</kbd>
        </div>
        <div className="search-results">
          {!query ? (
            <div className="search-hint">
              <Command size={26} />
              <p>Find a customer, document, product, or service record.</p>
              <small>Use Tab and Enter to navigate.</small>
            </div>
          ) : results.length ? (
            results.map(({ key, row }) => (
              <button
                className="search-result"
                key={key + row.id}
                onClick={() => {
                  router.push(recordPath(key, row.id));
                  setSearchOpen(false);
                }}
              >
                <span className="result-icon">
                  <Search size={16} />
                </span>
                <span>
                  <small>{moduleFor(key).title}</small>
                  <strong>{row.name}</strong>
                  <small>{row.organization || row.serial || row.sku}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))
          ) : (
            <Empty
              title="No matching records"
              description="Try a customer name, serial number, or document reference."
            />
          )}
        </div>
      </Modal>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Notifications"
        description={`${db.notifications.filter((n) => !n.read).length} unread updates across your workspace`}
        drawer
      >
        <div className="notification-toolbar">
          <select
            aria-label="Notification category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "All",
              "Finance",
              "Inventory",
              "Service",
              "Procurement",
              "Sales",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            className="text-btn"
            onClick={() =>
              commit((d) => {
                d.notifications.forEach((n) => (n.read = true));
              })
            }
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        </div>
        {db.notifications
          .filter((n) => category === "All" || n.category === category)
          .map((n) => (
            <div
              key={n.id}
              className={`notification-item ${n.read ? "" : "unread"}`}
            >
              <span className="notification-mark" />
              <div>
                <Badge>{n.category}</Badge>
                <Link
                  href={n.href}
                  onClick={() => {
                    commit((d) => {
                      d.notifications.find((x) => x.id === n.id)!.read = true;
                    });
                    setNotifications(false);
                  }}
                >
                  {n.name}
                </Link>
                <small>18 Sep 2026 · Workspace alert</small>
              </div>
              <button
                className="icon-btn"
                title={n.read ? "Marked as read" : "Mark as read"}
                aria-label={`Mark ${n.name} as read`}
                disabled={n.read}
                onClick={() =>
                  commit((d) => {
                    d.notifications.find((x) => x.id === n.id)!.read = true;
                  })
                }
              >
                <Check size={16} />
              </button>
            </div>
          ))}
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="Welcome to AMSS One"
        description="Your business operations, connected."
      >
        <div className="help-content">
          <h3>A few things to get you started</h3>
          <p>
            Use <kbd>⌘ / Ctrl K</kbd> to search across customers, equipment,
            invoices, and service tickets.
          </p>
          <p>
            The <strong>+ New</strong> menu creates records from anywhere. Open
            a record to view relationships, edit details, or move its workflow
            forward.
          </p>
          <p>
            Changes persist in this browser. This is a frontend demonstration
            with fictional business data; sign-in and role permissions are
            simulated.
          </p>
          <Link
            className="btn primary"
            href="/settings"
            onClick={() => setHelp(false)}
          >
            Open workspace settings <ArrowUpRight size={15} />
          </Link>
        </div>
      </Modal>
      {create && (
        <RecordForm
          module={moduleFor(create)}
          onClose={() => setCreate(null)}
        />
      )}
      <Toaster richColors position="bottom-right" closeButton />
    </div>
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <ShellInner>{children}</ShellInner>
    </DataProvider>
  );
}
