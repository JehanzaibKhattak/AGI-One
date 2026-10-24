# AGI One enterprise release gates

The standard is reliable customer workflows, safe administration, measured operating capacity and credible customer outcomes. Similar-looking screens do not establish parity with Salesforce or Microsoft Dynamics 365.

## Implemented and directly verifiable

- Account and workspace isolation, server authentication and protected mutations.
- Per-module view/create/edit/approve/export grants, with branch-scoped business data and shared catalogs.
- Database-enforced record identities, unique document numbers and product/customer codes, cross-record foreign keys, document-line constraints and PostgreSQL tenant policies.
- Targeted command reads, writes of changed records only, and bounded mutation responses.
- Indexed, cursor-paginated customer search, scoped relation pickers and permission-aware global search.
- Owner-managed branch creation, permissions, invitations, invitation revocation, member revocation/session invalidation and ownership transfer.
- Server-recorded administration and business audit events with a paginated audit viewer.
- Atomic quote-to-cash, purchasing receipt, service parts and inventory cancellation rules covered by tests.

## Release gates still open

| Gate                     | Required evidence before calling this enterprise-ready                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data scale               | Replace remaining compatibility snapshot reads in dashboards, reports and legacy modules. Move from workspace-wide optimistic revisions to per-record concurrency where appropriate. Publish realistic load/soak measurements and capacity limits. |
| Identity                 | Configure verified email, recovery, MFA and enterprise SSO with tested recovery and offboarding procedures.                                                                                                                                        |
| Daily sales productivity | Complete lead capture/conversion, tasks/reminders, configurable pipelines, forecasting, email/calendar activity and validated imports.                                                                                                             |
| Integrations             | Complete secure files, transactional email, durable jobs, API/webhooks and the integrations selected by pilot customers.                                                                                                                           |
| Financial correctness    | Integrate accounting or validate balanced posting, credits, returns, partial operations, currency precision and tax treatment. Operational totals are not statutory accounts.                                                                      |
| Reliability              | Deploy staging/production, monitoring, alerts, tested backup schedules, restore objectives and incident ownership.                                                                                                                                 |
| Security and privacy     | Independent review, least-privilege production credentials, retention/deletion, audit retention, field-level sharing and contractual controls.                                                                                                     |
| Customer proof           | Run an agreed pilot with real team workflows, migration reconciliation, support procedures, acceptance tests and measured adoption/outcomes.                                                                                                       |

## Current storage and access limits

Business records now live as separate indexed rows. Flexible attributes remain JSONB per record; document lines and references are relational. This is not a claim that every field has a dedicated typed column. The old workspace JSON column is retained as a migration rollback archive and is not used for current reads or writes.

The customer directory and team/audit/settings bootstraps use bounded data paths. Some legacy views still request a complete authorized projection for their calculations; these must be replaced before large-client rollout. Commands still use a workspace revision/lock, so unrelated simultaneous edits can require a retry.

Branch access applies to business records. Product/category/supplier/engineer/serial catalogs are shared within enabled modules. Members restricted to branches cannot see unassigned business records. Branch assignment is supported when creating records; governed reassignment and sharing workflows remain future work. Administration grants permit team/audit metadata; only owners can manage membership, settings and ownership. Non-owner audit readers do not receive raw event details.

PostgreSQL row policies use a trusted server transaction context. Use a dedicated non-superuser application role in production. These policies are not protection against stolen privileged database credentials or a compromised server.

Workspace switching, customer portals, custom fields, automation configuration, billing/entitlements and enterprise support commitments are not implemented yet.
