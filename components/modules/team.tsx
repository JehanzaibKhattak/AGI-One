"use client";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/ui";
import { getMember } from "@/lib/services/repository";
type Member = { id: string; name: string; email: string; role: string };
export function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/members")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setMembers(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <PageHeading
        title="Your team"
        description="Workspace access is enforced on the server."
      />
      <section className="panel workspace-card">
        <h2>Members</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Owners manage settings, approvals and invitations. Editors manage
          business records. Viewers have read-only access.
        </p>
      </section>
      {getMember().role === "owner" && (
        <section className="panel workspace-card">
          <h2>Invite a teammate</h2>
          <p>
            Invitations expire after seven days. Share the link privately with
            the specified email address.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              setLink("");
              const data = new FormData(event.currentTarget);
              try {
                const response = await fetch("/api/members", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: data.get("email"),
                    role: data.get("role"),
                  }),
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error);
                setLink(body.url);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Email address</span>
                <input type="email" name="email" required />
              </label>
              <label className="field">
                <span>Access</span>
                <select name="role">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
            </div>
            <button className="btn primary" disabled={pending}>
              {pending ? "Creating invitation…" : "Create invitation link"}
            </button>
          </form>
          {link && (
            <label className="field">
              <span>Invitation link</span>
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
          )}
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
