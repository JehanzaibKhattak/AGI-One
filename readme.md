# AGI One

A CRM and operations workspace connecting customer relationships, opportunities, quotations, inventory, procurement, service, and collections.

AGI One now starts with an **empty workspace**. There are no client-specific records, proposals, default passwords, or sample financial figures in the application. Earlier project history is retained in Git; removing files from the active tree does not erase earlier commits.

## Local setup

Requires Node.js 24 and PostgreSQL 15 or newer.

1. Create a dedicated PostgreSQL database and application user.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`. Set your database connection and application URL. Generate a secret with `openssl rand -base64 48`.
4. Run `npm run db:migrate` to create Better Auth and AGI One tables.
5. Run `npm run dev`, open the configured application URL, and create your account. Verify your email using the private local preview described in [account security setup](docs/account-security.md), then sign in.
6. Create a workspace, select its base currency, and add your first customer.

The example database URL points to a local development database on port 55439. Replace it for your installation. Production must use a private database connection, HTTPS, a dedicated database role and a strong secret. Never commit `.env.local`.

## Accounts and teams

- Better Auth manages passwords, verified email, password recovery, authenticator MFA, encrypted backup codes, database-backed sessions, HTTP-only cookies and database-backed authentication rate limits.
- Every account must verify email before workspace access. Local setup uses private email previews; deployed environments require SMTP. Password reset revokes sessions and preserves MFA. Account security provides password changes and session management. See [setup and recovery limits](docs/account-security.md).
- Protected workspace pages verify the server session and database membership.
- Workspace reads and writes derive the workspace from the authenticated user. Client-supplied workspace IDs are never trusted.
- Owners control settings and membership. Editor/viewer base roles can be refined with per-module view/create/edit/approve/export grants and branch scopes. Restrictions are enforced on reads, commands, searches and server exports.
- Invitation links are one-time, expire after seven days, carry their configured grants/branches and must be accepted by the specified email address. Owners can revoke invitations or members, edit permissions and transfer ownership with email confirmation. Member revocation ends active sessions. Share links privately; automated invitation email is not enabled.
- Each account currently belongs to one workspace. Workspace switching is not implemented. Branch-scoped users see assigned business records and shared catalogs within their enabled modules.

## Data and workflows

Changes run through authenticated command endpoints and PostgreSQL transactions. A row lock and revision check prevent conflicting edits and partial saves. A stale edit gets an explicit conflict response; refresh and retry. The browser refreshes on focus and every 30 seconds. It does not store business data in localStorage.

A request-local business engine handles quote conversion, order-owned stock allocations, delivery, invoice creation, receipt allocation, purchase receiving, service-part issues and reservation release on cancellation. Direct edits cannot mark an order delivered or fabricate payment status. Issued invoices are locked against financial edits; invoices with payments cannot be edited.

Purchase orders submitted for approval create an approval request. Owners or explicitly authorized approvers approve them before full receipt. Receipt increases warehouse stock; delivery and service parts reduce it. Partial receipts, partial delivery, returns, stock adjustments, serial/lot allocation and credit notes are pending work.

New document numbers are assigned inside the locked server transaction. Submitted documents are protected from duplicate numbers and duplicate quote conversion or invoicing. Sales documents use the workspace base currency; purchase orders support a recorded exchange rate. Money calculations round totals to two decimal places; currencies with other minor-unit rules are not yet supported.

Dashboard metrics are calculated from issued invoices, receipts and current records. Draft and cancelled invoices do not count as receivables or sales. The finance section explicitly presents operational totals; it is **not a general ledger** and does not produce statutory statements or certify bank reconciliation. File uploads are disabled until actual secure storage is added.

Business records are now separate indexed `agi_records` rows, with typed document lines, relational references, unique identifiers, tenant policies and branch foreign keys. The migration backfills old workspace snapshots transactionally and marks them migrated. The legacy workspace JSON is retained for rollback only; current operations do not update it.

Commands load their target records and dependencies, run inside a database transaction and persist changed records only. Responses carry deltas. The customer directory, relation pickers and global search use scoped SQL queries and cursor pagination. Team/settings/audit bootstraps do not download the customer database. Administrative events are browsable in the audit trail.

Some legacy screens still request a complete authorized projection. Workspace-level revision checks still serialize/conflict unrelated edits. These remain scale limits, alongside the need for realistic production load measurements; see [enterprise release gates](docs/enterprise-release-gates.md).

## Sales workspace

Lead qualification and atomic customer/contact/opportunity conversion, assigned tasks with in-app reminders, owner-configured sales pipelines and permission-scoped forecasting are available. Sales directories use server pagination and forecasts use SQL aggregation. See [sales workflow behavior and limits](docs/sales-workspace.md).

Microsoft 365 provides an optional, personal, read-only view of inbox headers and upcoming calendar meetings. An Entra app registration and server-side secrets are required before connecting accounts; follow [Microsoft 365 setup](docs/microsoft-365.md). Stored credentials are encrypted and removed on disconnect or membership revocation. No email sending, calendar writes or background synchronization is enabled.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run db:migrate
npm run test:db
npm run build
npm start
BASE_URL=http://localhost:3000 npm run test:e2e
```

Install a test browser with `npx playwright install chromium`. To use installed Chrome, set `CHROMIUM_PATH` to its executable. Browser tests create disposable accounts and records in the configured database. Run them against a dedicated local or CI database, never production.

[Local verification results](docs/verification.md) document the current checks.

Database integration checks use a temporary non-superuser role and verify tenant policies, foreign keys, stock constraints, targeted loads and branch-scoped pagination across 2,000 generated customers. Run them only against a disposable development/CI database with role-creation privileges.

Tests cover clean onboarding, persistent customer creation, quote-to-cash, receiving, status bypass rejection, optimistic conflicts, request origins, server-stamped actors, isolated workspaces and viewer denial. `.github/workflows/ci.yml` provisions disposable PostgreSQL and runs checks against a production build.

## Backups and operations

Use your PostgreSQL provider's scheduled backups and point-in-time recovery. For self-hosted installations, schedule encrypted `pg_dump` backups outside the application, restrict access, and test restoring them into an isolated database. Workspace JSON exports are convenient data exports, not substitutes for database backups: they exclude accounts, membership, invitations and the separate audit-event table.

Deployment, production database provisioning, live SMTP deliverability, enterprise SSO, monitoring, backup scheduling and recovery drills still need environment-specific setup. See [the release roadmap](docs/release-roadmap.md) before onboarding live clients.
