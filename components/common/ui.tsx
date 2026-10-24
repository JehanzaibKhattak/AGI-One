"use client";
import { Dialog, DropdownMenu, AlertDialog } from "radix-ui";
import { X, ChevronDown, Inbox, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
export function Badge({ children }: { children: React.ReactNode }) {
  const s = String(children);
  const tone =
    /Paid|Active|Won|Received|Resolved|Closed|Completed|Installed|In Stock|Approved|Met|Healthy|Available|Delivered|Renewed/.test(
      s,
    )
      ? "green"
      : /Overdue|Critical|Breached|Out of Stock|Expired|Rejected|Lost|Out of Service/.test(
            s,
          )
        ? "red"
        : /Pending|Waiting|Due|Low Stock|High|Negotiation|Maintenance|Preparing|Within \d|Approval/.test(
              s,
            )
          ? "amber"
          : "blue";
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={cn("modal", wide && "modal-wide", drawer && "drawer")}
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="dialog-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-btn" aria-label="Close dialog">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Menu({
  label,
  children,
  className = "btn",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={className}>{label}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown" align="end" sideOffset={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
export function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <DropdownMenu.Item className="menu-item" onSelect={onClick}>
      {children}
    </DropdownMenu.Item>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-overlay" />
        <AlertDialog.Content className="modal confirm">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <div className="modal-footer">
            <AlertDialog.Cancel className="btn">Cancel</AlertDialog.Cancel>
            <AlertDialog.Action className="btn danger" onClick={onConfirm}>
              Confirm
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
export function Empty({
  title = "No records found",
  description = "Try adjusting your search or filters.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  change,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  change?: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="stat-label">
        {label}
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className="stat-change">
          <span>{change}</span>
          <span className="muted"> vs. previous period</span>
        </div>
      )}
    </>
  );
  return href ? (
    <Link className="stat" href={href}>
      {content}
      <ArrowUpRight className="stat-arrow" size={14} />
    </Link>
  ) : (
    <div className="stat">{content}</div>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="select-wrap">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}
