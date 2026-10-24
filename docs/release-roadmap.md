# AGI One release roadmap

## Completed foundation

- Independent AGI One branding; previous business materials and sample records removed from the active project.
- Empty-workspace onboarding and configurable company, timezone and base currency.
- PostgreSQL-backed accounts, sessions, workspace data, membership and audit events.
- Server-enforced owner/editor/viewer roles and one-time, email-bound team invitations.
- Validated server commands, workspace isolation, revision checks and transactional writes.
- Order-owned stock allocation, receiving, service-part consumption, cancellation release and payment protections.
- Live dashboard/report inputs and correct draft-invoice receivable treatment.
- Removal of fabricated financial statements, mock permission controls and simulated attachment uploads.
- Workflow regression tests and production-build browser checks in CI.

## Required before a live client pilot

1. Provision production and staging PostgreSQL, HTTPS domains, least-privilege database access and managed secrets. Run migrations as a separate deployment step.
2. Configure verified email, account recovery and reliable transactional email. Add MFA/SSO if required by the pilot's security policy. Resolve identity assurance before external team rollout.
3. Normalize business records into indexed relational tables with database foreign keys and unique constraints; replace whole-workspace reads with paginated, permission-scoped queries. Measure load and storage limits with representative client data.
4. Add branch and module permissions, member revocation, ownership transfer and a governed workspace switching model. Current roles grant broad workspace read access, including finance and exports.
5. Finish inventory returns/adjustments, partial receiving/delivery, serial/lot/expiry allocation, purchasing tax and landed-cost posting. Validate real warehouse workflows with the client.
6. Integrate a proven accounting system or implement balanced journal posting, supplier bills, credit notes/reversals, currency precision rules and validated tax treatment. Current finance totals do not replace accounting.
7. Implement file storage with private access, upload limits, scanning and retention; then enable attachments. Add background reminders and an observable delivery/retry mechanism.
8. Add error monitoring, service health checks, request logs with sensitive-data redaction, alerting, backup schedules, restore drills, incident ownership and operational runbooks.
9. Build validated CSV import with previews, duplicate detection and rollback. Test migration on representative records before importing a client's actual data.
10. Complete accessibility, mobile and browser checks, security review, privacy/deletion/retention policies, performance testing and customer acceptance criteria.

## Competitive product depth

Prioritize these using customer evidence rather than claiming feature parity:

- Lead capture and qualification, task queues, reminders, timelines and sales forecasting.
- Connected email/calendar, logged communication and governed WhatsApp/telephony integrations.
- Configurable fields, pipelines, forms, approval policies and automation.
- Customer portals, knowledge base, service-level policies and dispatch/mobile workflows.
- API/webhooks, integration authentication, rate limits and developer documentation.
- Saved reports, consistent metrics, forecast snapshots and permission-aware analytics.
- Billing/entitlements, account administration, support processes and measurable uptime commitments.
- AI features only after reliable data, permissions and customer value are established.

## Release acceptance

Demonstrate quote → approval → reservation → delivery → invoice → payment, plus purchase receipt and service-part consumption, using simultaneous accounts and realistic data. Prove denied access, cross-workspace isolation, stale-edit handling, backup restoration and reconciled financial outputs. A passing local build alone is not release acceptance or competitive parity.
