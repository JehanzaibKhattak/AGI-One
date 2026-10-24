"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useDatabase } from "@/lib/services/provider";
import { repository, receivePayment, uid } from "@/lib/services/repository";
import { type Module, type Field } from "@/lib/constants/modules";
import { totals } from "@/lib/utils";
import { Modal } from "@/components/common/ui";
import type { BaseRecord, Entity, Collection } from "@/types";
function fieldSchema(field: Field) {
  if (field.type === "checkbox") return z.boolean();
  if (field.type === "number")
    return z.coerce
      .number()
      .min(0, "Must be zero or greater")
      .max(
        field.key === "probability" || field.key === "compliance" ? 100 : 1e12,
      );
  if (field.type === "email")
    return field.required
      ? z.email("Enter a valid email")
      : z.union([z.email("Enter a valid email"), z.literal("")]);
  return field.required
    ? z.string().trim().min(1, `${field.label} is required`)
    : z.string();
}
export function RecordForm({
  module,
  record,
  onClose,
  defaults = {},
}: {
  module: Module;
  record?: BaseRecord;
  onClose: () => void;
  defaults?: Record<string, unknown>;
}) {
  const db = useDatabase();
  const [error, setError] = useState("");
  const fields = module.fields;
  const initial: Record<string, unknown> = Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.default ??
        (f.type === "checkbox" ? false : f.type === "number" ? 0 : ""),
    ]),
  );
  const form = useForm<Record<string, unknown>>({
    defaultValues: {
      ...initial,
      status: module.statuses[0],
      ...defaults,
      ...record,
    },
  });
  const values = useWatch({ control: form.control });
  const submit = form.handleSubmit(async (input) => {
    setError("");
    const schema = z.object({
      ...Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)])),
      status: z.string(),
    });
    const result = schema.safeParse(input);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        form.setError(String(issue.path[0]), { message: issue.message }),
      );
      return;
    }
    try {
      const data = {
        ...result.data,
        id: record?.id || uid(module.key),
        createdAt: record?.createdAt || new Date().toISOString(),
      } as Entity<Collection>;
      if (
        module.key === "organizations" &&
        !(data as unknown as Record<string, unknown>).code
      )
        (data as unknown as Record<string, unknown>).code =
          `CUS-${String(db.organizations.length + 1).padStart(4, "0")}`;
      for (const field of fields.filter((f) => f.relation)) {
        const value = input[field.key];
        if (!value) continue;
        const linked = (
          db[field.relation!] as (BaseRecord & { organizationId?: string })[]
        ).find((r) => r.id === value);
        if (!linked) throw new Error(`${field.label} no longer exists.`);
        if (
          linked.organizationId &&
          input.organizationId &&
          linked.organizationId !== input.organizationId
        )
          throw new Error(
            `${field.label} must belong to the selected customer.`,
          );
      }
      if (module.key === "tickets")
        Object.assign(data, {
          parts: record && "parts" in record ? record.parts : [],
          attachments:
            record && "attachments" in record ? record.attachments : [],
        });
      if (module.key === "orders") {
        const q = db.quotations.find((q) => q.id === input.quotationId);
        if (!q) throw new Error("Choose a quotation to create a linked order.");
        if (q.organizationId !== input.organizationId)
          throw new Error("The quotation must belong to this customer.");
        if (
          db.orders.some((o) => o.quotationId === q.id && o.id !== record?.id)
        )
          throw new Error("This quotation already has an order.");
        Object.assign(data, {
          items: q.items,
          fulfilment: "0%",
          payment: "Unpaid",
          total: totals(q.items).total,
        });
      }
      if (module.key === "payments") {
        if (record) throw new Error("Posted receipts cannot be edited.");
        receivePayment(data as Entity<"payments">);
      } else if (record) repository(module.key).update(record.id, data);
      else repository<Collection>(module.key).create(data);
      toast.success(`${module.singular} ${record ? "updated" : "created"}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this record.");
    }
  });
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={`${record ? "Edit" : "New"} ${module.singular.toLowerCase()}`}
      description="Changes are saved to your demo workspace."
      wide
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          {fields.map((field) => {
            let options = field.relation
              ? (
                  db[field.relation] as (BaseRecord & {
                    organizationId?: string;
                  })[]
                )
                  .filter(
                    (r) =>
                      !r.organizationId ||
                      !values.organizationId ||
                      r.organizationId === values.organizationId,
                  )
                  .map((r) => ({ value: r.id, label: r.name }))
              : field.options?.map((v) => ({ value: v, label: v }));
            if (field.key === "invoiceId")
              options = options?.filter(
                (o) =>
                  db.invoices.find((i) => i.id === o.value)?.status !==
                  "Cancelled",
              );
            return (
              <label
                className={field.type === "textarea" ? "field full" : "field"}
                key={field.key}
              >
                <span>
                  {field.label}
                  {field.required && <b className="required"> *</b>}
                </span>
                {field.type === "select" ? (
                  <select {...form.register(field.key)}>
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {options?.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea rows={3} {...form.register(field.key)} />
                ) : (
                  <input
                    type={field.type || "text"}
                    step={field.type === "number" ? "0.01" : undefined}
                    {...form.register(field.key)}
                  />
                )}{" "}
                {form.formState.errors[field.key] && (
                  <small className="field-error">
                    {String(form.formState.errors[field.key]?.message)}
                  </small>
                )}
              </label>
            );
          })}
          {module.statuses.length > 1 && (
            <label className="field">
              <span>Status</span>
              <select {...form.register("status")}>
                {module.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={form.formState.isSubmitting}
            className="btn primary"
            type="submit"
          >
            {form.formState.isSubmitting
              ? "Saving…"
              : record
                ? "Save changes"
                : `Create ${module.singular.toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
