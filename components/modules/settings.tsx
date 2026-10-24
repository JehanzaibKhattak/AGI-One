"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Save, Download } from "lucide-react";
import { PageHeading } from "@/components/common/ui";
import { useDatabase } from "@/lib/services/provider";
import {
  updateSettings,
  getMember,
  getRevision,
} from "@/lib/services/repository";
import { download } from "@/lib/utils";
const sections: Record<string, [string, string][]> = {
  "Company Profile": [
    ["company", "Company name"],
    ["email", "Email address"],
    ["phone", "Phone number"],
    ["address", "Registered address"],
  ],
  "Regional Settings": [
    ["currency", "Base currency"],
    ["timezone", "Business timezone"],
    ["tax", "Default sales tax (%)"],
  ],
  "Sales & Service": [
    ["paymentTerms", "Default payment terms"],
    ["sla", "Critical response time (hours)"],
    ["quotationPrefix", "Quotation prefix"],
    ["invoicePrefix", "Invoice prefix"],
  ],
  Branches: [["branches", "Branch locations"]],
};
export function Settings() {
  const db = useDatabase();
  const [section, setSection] = useState("Company Profile");
  const [values, setValues] = useState(db.settings);
  const [pending, setPending] = useState(false);
  const [editRevision, setEditRevision] = useState(getRevision);
  const owner = getMember().role === "owner";
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Make AGI One work the way your business does."
      >
        <button
          className="btn"
          onClick={() =>
            download(
              "agi-one-workspace-export.json",
              JSON.stringify(
                { version: 1, exportedAt: new Date().toISOString(), data: db },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          <Download size={15} />
          Export workspace data
        </button>
      </PageHeading>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings categories">
          {Object.keys(sections).map((s) => (
            <button
              key={s}
              className={s === section ? "active" : ""}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </nav>
        <section className="panel workspace-card">
          <h2>{section}</h2>
          <p>
            {owner
              ? "Changes apply to your whole workspace."
              : "Only the workspace owner can change these preferences."}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              try {
                await updateSettings(values, editRevision);
                setEditRevision(getRevision());
                toast.success("Workspace settings saved");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="form-grid">
              {sections[section].map(([key, label]) => (
                <label className="field full" key={key}>
                  <span>{label}</span>
                  <input
                    disabled={!owner || pending}
                    required={[
                      "company",
                      "currency",
                      "timezone",
                      "sla",
                    ].includes(key)}
                    type={
                      key === "email"
                        ? "email"
                        : ["tax", "sla"].includes(key)
                          ? "number"
                          : "text"
                    }
                    min={key === "sla" ? 1 : 0}
                    max={key === "tax" ? 100 : undefined}
                    value={values[key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            {owner && (
              <div className="modal-footer">
                <button className="btn primary" disabled={pending}>
                  <Save size={15} />
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </form>
        </section>
      </div>
    </>
  );
}
