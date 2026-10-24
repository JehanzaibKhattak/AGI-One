# AGI One verification

Verified locally on 25 October 2026 against PostgreSQL 15 and the Next.js 16.4.3 production build.

| Check                         | Result                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit/regression tests         | 21 passed                                                                                              |
| Database integration scenario | Passed: constraints, targeted loading, tenant policies and 2,000-customer branch-scoped pagination     |
| TypeScript and ESLint         | Passed without warnings                                                                                |
| Production build              | Passed                                                                                                 |
| Production browser suites     | 2 passed: CRM/business flows and enterprise access administration                                      |
| Routes and mobile             | 30 workspace routes, 390px dashboard/customer-directory layouts, keyboard relation selection           |
| Migration                     | Existing development snapshots backfilled successfully; repeated migration succeeded                   |
| Database backup/restore       | Record rows, document lines, references, workspaces and audit events restored into a separate database |

The CRM browser suite covers real sign-up/sign-in, empty onboarding, persistent customer creation, quote-to-cash, purchasing receipt, inventory protections, conflicting edits and tenant isolation.

The administration suite uses separate real accounts to check branch creation, scoped invitations, hidden financial records/navigation, denied exports, allowed and denied branch edits, mid-session permission changes, owner self-revocation protection, ownership transfer, loss of the former owner's administration rights, member revocation/session invalidation and revoked invitation rejection. It also exercises server-filtered exports and keyboard selection of a related organization from a customer-directory bootstrap containing no customer records.

The database scenario uses 2,000 generated customer records, checks non-overlapping cursor pages within one branch, verifies forbidden foreign keys and negative stock, and confirms that a customer update loads one customer rather than the complete directory. A temporary non-superuser/NOBYPASSRLS role cannot read, update or insert another workspace's records. These are integrity and bounded-query checks, not a production load/soak benchmark.

Test fixtures are generic and isolated from the empty application initializer. PostgreSQL role-creation tests must run only against a disposable development/CI database. The migration retains the old workspace JSON as a rollback archive; current operations use the record store.

GitHub Actions is configured to repeat unit, database and production browser checks with disposable PostgreSQL 17. Its hosted result is separate from this local verification record.

This is not certification of parity with Salesforce or Microsoft Dynamics 365. See [enterprise release gates](enterprise-release-gates.md) for open work: remaining compatibility reads and workspace-wide concurrency, daily sales productivity, identity/recovery/SSO, integrations, financial posting, production operations and a validated customer pilot.
