"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Save, RotateCcw, Download } from "lucide-react";
import { PageHeading, Confirm } from "@/components/common/ui";
import { useDatabase } from "@/lib/services/provider";
import { commit, resetDemo } from "@/lib/services/repository";
import { download } from "@/lib/utils";
const sections: Record<string, [string, string][]> = {
  "Company Profile": [
    ["company", "Company name"],
    ["email", "Email address"],
    ["phone", "Phone number"],
    ["address", "Registered address"],
  ],
  Branches: [["branches", "Branch locations"]],
  Warehouses: [["warehousePolicy", "Default receiving policy"]],
  Taxes: [["tax", "Default sales tax (%)"]],
  Currencies: [["currency", "Base currency"]],
  "Number Sequences": [
    ["quotationPrefix", "Quotation prefix"],
    ["invoicePrefix", "Invoice prefix"],
  ],
  "Payment Terms": [["paymentTerms", "Default payment terms"]],
  "Service SLA": [["sla", "Critical response time (hours)"]],
  "Quotation Templates": [["quotationTemplate", "Template title"]],
  "Invoice Templates": [["invoiceTemplate", "Template title"]],
  "Notification Preferences": [["notifications", "Notifications"]],
  "System Preferences": [["theme", "Default theme"]],
};
export function Settings() {
  const db = useDatabase();
  const [section, setSection] = useState("Company Profile");
  const [values, setValues] = useState(db.settings);
  const [reset, setReset] = useState(false);
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Make AMSS One work the way your business does."
      >
        <button
          className="btn"
          onClick={() =>
            download(
              "amss-demo-backup.json",
              JSON.stringify({ version: 1, data: db }, null, 2),
              "application/json",
            )
          }
        >
          <Download size={15} />
          Export demo backup
        </button>
      </PageHeading>
      <div className="settings-layout">
        <nav aria-label="Settings categories" className="settings-nav">
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
        <div>
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>{section}</h2>
                <p>Saved preferences for your demonstration workspace.</p>
              </div>
              <Building2 size={20} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commit((d) => {
                  d.settings = values;
                });
                toast.success("Workspace settings saved");
              }}
            >
              <div className="form-grid">
                {sections[section].map(([key, label]) => (
                  <label className="field full" key={key}>
                    <span>{label}</span>
                    {key === "notifications" ? (
                      <select
                        value={values[key] || "Enabled"}
                        onChange={(e) =>
                          setValues({ ...values, [key]: e.target.value })
                        }
                      >
                        <option>Enabled</option>
                        <option>Disabled</option>
                      </select>
                    ) : key === "theme" ? (
                      <select value="Light" onChange={() => {}}>
                        <option>Light</option>
                      </select>
                    ) : (
                      <input
                        required
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
                        onChange={(e) =>
                          setValues({ ...values, [key]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
                {[
                  "Warehouses",
                  "Number Sequences",
                  "Quotation Templates",
                  "Invoice Templates",
                  "Notification Preferences",
                  "System Preferences",
                ].includes(section) && (
                  <p className="muted full">
                    These are saved configuration previews. Automated numbering,
                    template rendering, and notification delivery will be
                    connected during backend integration.
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn primary">
                  <Save size={15} />
                  Save changes
                </button>
              </div>
            </form>
          </section>
          <section className="panel demo-settings">
            <h2>Demo workspace</h2>
            <p>
              This browser stores fictional customers and transactions.
              Resetting restores the original sample data and removes local
              edits.
            </p>
            <button
              className="btn danger-outline"
              onClick={() => setReset(true)}
            >
              <RotateCcw size={15} />
              Reset demo data
            </button>
          </section>
        </div>
      </div>
      <Confirm
        open={reset}
        onOpenChange={setReset}
        title="Reset your demo workspace?"
        description="All locally created records and edits will be replaced with the original demo dataset. Export a backup first if you want to keep a copy."
        onConfirm={() => {
          resetDemo();
          toast.success("Demo data restored");
        }}
      />
    </>
  );
}
