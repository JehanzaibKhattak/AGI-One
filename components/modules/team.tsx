"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeading, Modal } from "@/components/common/ui";
import {
  AccessEditor,
  type AccessSelection,
} from "@/components/forms/access-editor";
import { getMember, initialize } from "@/lib/services/repository";
import type { Grants, Branch } from "@/lib/access";
type Member = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  grants: Grants;
  branch_ids: string[];
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
};
export function Team() {
  const router = useRouter();
  const current = getMember();
  const owner = current.role === "owner";
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(0);
  const [scope, setScope] = useState<AccessSelection>({
    role: "editor",
    grants: {},
    branch_ids: [],
  });
  const [editing, setEditing] = useState<Member | null>(null);
  const [editScope, setEditScope] = useState<AccessSelection>(scope);
  const [confirm, setConfirm] = useState<{
    kind: "member" | "invitation" | "transfer";
    id: string;
    email: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/members"), fetch("/api/branches")])
      .then(async (responses) => {
        const [team, branchRows] = await Promise.all(
          responses.map((r) => r.json()),
        );
        if (!responses[0].ok) throw new Error(team.error);
        if (!responses[1].ok) throw new Error(branchRows.error);
        if (active) {
          setMembers(team.members);
          setInvitations(team.invitations);
          setBranches(branchRows);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [version]);
  const send = async (path: string, method: string, data: unknown) => {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  };
  const reload = async () => {
    await initialize();
    setVersion((previous) => previous + 1);
  };
  return (
    <>
      <PageHeading
        title="Team & access"
        description="Control who can view, change, approve and export workspace records."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel workspace-card">
        <h2>Members</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Branches</th>
                {owner && <th>Manage access</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>{member.role}</td>
                  <td>
                    {member.branch_ids.length
                      ? member.branch_ids
                          .map(
                            (id) =>
                              branches.find((b) => b.id === id)?.name || id,
                          )
                          .join(", ")
                      : "All branches"}
                  </td>
                  {owner && (
                    <td>
                      {member.id !== current.id ? (
                        <div className="team-member-actions">
                          <button
                            className="btn"
                            onClick={() => {
                              setEditing(member);
                              setEditScope({
                                role: member.role as "editor" | "viewer",
                                grants: member.grants,
                                branch_ids: member.branch_ids,
                              });
                            }}
                          >
                            Edit access
                          </button>
                          <button
                            className="btn"
                            onClick={() =>
                              setConfirm({
                                kind: "transfer",
                                id: member.id,
                                email: member.email,
                              })
                            }
                          >
                            Transfer ownership
                          </button>
                          <button
                            className="btn danger-outline"
                            onClick={() =>
                              setConfirm({
                                kind: "member",
                                id: member.id,
                                email: member.email,
                              })
                            }
                          >
                            Revoke access
                          </button>
                        </div>
                      ) : (
                        "You · owner"
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Access changes take effect on the server immediately. Revoking a
          member also ends their active sessions.
        </p>
      </section>
      {owner && (
        <>
          <section className="panel workspace-card">
            <h2>Branches</h2>
            <p>
              Create real operating locations, then assign access and customer
              records to them.
            </p>
            <div className="branch-choices">
              {branches.map((branch) => (
                <span className="badge" key={branch.id}>
                  {branch.name}
                </span>
              ))}
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                setPending(true);
                setError("");
                try {
                  await send("/api/branches", "POST", {
                    name: data.get("name"),
                  });
                  form.reset();
                  await reload();
                  toast.success("Branch created");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              <label className="field">
                <span>New branch name</span>
                <input name="name" required maxLength={100} />
              </label>
              <button className="btn" disabled={pending}>
                Add branch
              </button>
            </form>
          </section>
          <section className="panel workspace-card">
            <h2>Invite a teammate</h2>
            <p>
              Links expire after seven days and can only be accepted once, using
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
                  const body = await send("/api/members", "POST", {
                    email: data.get("email"),
                    ...scope,
                  });
                  setLink(body.url);
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              <label className="field">
                <span>Email address</span>
                <input type="email" name="email" required />
              </label>
              <AccessEditor
                value={scope}
                onChange={setScope}
                branches={branches}
                disabled={pending}
              />
              <button className="btn primary" disabled={pending}>
                {pending ? "Creating invitation…" : "Create invitation link"}
              </button>
            </form>
            {link && (
              <label className="field">
                <span>Invitation link</span>
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
          </section>
          <section className="panel workspace-card">
            <h2>Pending invitations</h2>
            {invitations.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Expires</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>{invitation.email}</td>
                        <td>{invitation.role}</td>
                        <td>
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </td>
                        <td>
                          <button
                            className="btn"
                            onClick={() =>
                              setConfirm({
                                kind: "invitation",
                                id: invitation.id,
                                email: invitation.email,
                              })
                            }
                          >
                            Revoke invitation
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No pending invitations.</p>
            )}
          </section>
        </>
      )}
      {editing && (
        <Modal
          open
          title={`Access for ${editing.name}`}
          description="Changes apply to future requests immediately."
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          wide
        >
          <AccessEditor
            value={editScope}
            onChange={setEditScope}
            branches={branches}
            disabled={pending}
          />
          <div className="modal-footer">
            <button className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await send("/api/members", "PATCH", {
                    action: "update",
                    userId: editing.id,
                    ...editScope,
                  });
                  setEditing(null);
                  await reload();
                  toast.success("Access updated");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              Save access
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          open
          title={
            confirm.kind === "transfer"
              ? "Transfer workspace ownership"
              : "Revoke access"
          }
          description={
            confirm.kind === "transfer"
              ? "The new owner will control this workspace. Your account will become an editor, and pending invitations will be revoked."
              : "The selected access will stop working immediately."
          }
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
        >
          <p>{confirm.email}</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setPending(true);
              setError("");
              try {
                await send(
                  "/api/members",
                  confirm.kind === "transfer" ? "PATCH" : "DELETE",
                  confirm.kind === "transfer"
                    ? {
                        action: "transfer",
                        userId: confirm.id,
                        email: data.get("email"),
                      }
                    : { kind: confirm.kind, id: confirm.id },
                );
                const transferred = confirm.kind === "transfer";
                setConfirm(null);
                if (transferred) {
                  await initialize();
                  router.replace("/dashboard");
                  router.refresh();
                } else await reload();
                toast.success(
                  transferred ? "Ownership transferred" : "Access revoked",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            {confirm.kind === "transfer" && (
              <label className="field">
                <span>Type the new owner’s email to confirm</span>
                <input name="email" type="email" required />
              </label>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button className="btn danger-outline" disabled={pending}>
                {confirm.kind === "transfer"
                  ? "Confirm transfer"
                  : "Confirm revocation"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
