"use client";
import {
  areas,
  actions,
  can,
  type Access,
  type AccessAction,
  type Grants,
  type Branch,
} from "@/lib/access";
export type AccessSelection = {
  role: "editor" | "viewer";
  grants: Grants;
  branch_ids: string[];
};
export function AccessEditor({
  value,
  onChange,
  branches,
  disabled = false,
}: {
  value: AccessSelection;
  onChange: (value: AccessSelection) => void;
  branches: Branch[];
  disabled?: boolean;
}) {
  const effective = { ...value } as Access;
  return (
    <>
      <label className="field">
        <span>Base role</span>
        <select
          aria-label="Base role"
          disabled={disabled}
          value={value.role}
          onChange={(event) =>
            onChange({
              role: event.target.value as "editor" | "viewer",
              grants: {},
              branch_ids: value.branch_ids,
            })
          }
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <details>
        <summary>Module permissions</summary>
        <p>
          Clearing View removes all access to that module. Owner-only account
          administration remains protected.
        </p>
        <div className="access-matrix">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                {actions.map((action) => (
                  <th key={action}>{action}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area}>
                  <th>{area}</th>
                  {actions.map((action) => (
                    <td key={action}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        aria-label={`${area} ${action}`}
                        checked={can(effective, area, action)}
                        onChange={(event) => {
                          let current = actions.filter((a) =>
                            can(effective, area, a),
                          );
                          if (event.target.checked)
                            current = [
                              ...new Set<AccessAction>([
                                ...current,
                                "view",
                                action,
                              ]),
                            ];
                          else
                            current =
                              action === "view"
                                ? []
                                : current.filter((a) => a !== action);
                          onChange({
                            ...value,
                            grants: { ...value.grants, [area]: current },
                          });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <h3>Branch access</h3>
      <p>
        {value.branch_ids.length
          ? "Only records in the selected branches are accessible. Shared product and supplier catalogs remain available when their modules are enabled."
          : "All branches, including unassigned records."}
      </p>
      <div className="branch-choices">
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={!value.branch_ids.length}
            onChange={() => onChange({ ...value, branch_ids: [] })}
          />{" "}
          All branches
        </label>
        {branches.map((branch) => (
          <label key={branch.id}>
            <input
              disabled={disabled}
              type="checkbox"
              aria-label={`Access branch ${branch.name}`}
              checked={value.branch_ids.includes(branch.id)}
              onChange={(event) =>
                onChange({
                  ...value,
                  branch_ids: event.target.checked
                    ? [...value.branch_ids, branch.id]
                    : value.branch_ids.filter((id) => id !== branch.id),
                })
              }
            />{" "}
            {branch.name}
          </label>
        ))}
      </div>
    </>
  );
}
