# AGI One verification

Verified locally on 26 October 2026 against PostgreSQL 15 and the Next.js 16.4.3 production build.

| Check                         | Result                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Unit/regression tests         | 30 passed                                                                                                                    |
| Database integration scenario | Passed: constraints, targeted loading, tenant policies and 2,000-customer branch-scoped pagination                           |
| TypeScript and ESLint         | Passed without warnings                                                                                                      |
| Production build              | Passed                                                                                                                       |
| Production browser suites     | 2 passed: CRM/sales/business flows and enterprise access administration                                                      |
| Routes and mobile             | 36 workspace routes plus verification/recovery/MFA pages, 390px dashboard/customer/task layouts, keyboard relation selection |
| Migration                     | Existing development snapshots backfilled successfully; repeated migration succeeded                                         |
| Database backup/restore       | Fresh isolated restores include sales/connection records, MFA tables and both access-revocation triggers                     |

The CRM browser suite covers real sign-up/sign-in, empty onboarding, persistent customer creation, quote-to-cash, purchasing receipt, inventory protections, conflicting edits and tenant isolation. It also creates a qualified lead in the UI, converts it into a linked customer/contact/opportunity, edits a pipeline stage and verifies the changed weighted forecast, closes the deal, assigns/completes a task, checks personal reminders, rejects unknown assignees, checks Microsoft setup/callback guards and exercises the sales pages on mobile.

The identity flow additionally checks verified signup before workspace access, authenticator enrollment with an invalid and valid code, session revocation on MFA changes, second-factor login, one-use backup codes, generic recovery responses, password reset/token replay rejection, invalidation of pending MFA challenges, preserved MFA after recovery, password changes and security audit records. Desktop/mobile account-security views are checked without exposing setup keys or backup codes in screenshots.

The administration suite uses separate real accounts to check branch creation, scoped invitations, hidden financial records/navigation, denied exports, allowed and denied branch edits, mid-session permission changes, owner self-revocation protection, ownership transfer, loss of the former owner's administration rights, member revocation/session invalidation and revoked invitation rejection. It also checks branch-filtered forecasts, blocked pipeline administration by non-owners, and rejection of task assignments outside a teammate’s branch. It exercises server-filtered exports and keyboard selection of a related organization from a customer-directory bootstrap containing no customer records.

The database scenario uses 2,000 generated customer records, checks non-overlapping cursor pages within one branch, verifies forbidden foreign keys and negative stock, and confirms that a customer update loads one customer rather than the complete directory. A temporary non-superuser/NOBYPASSRLS role cannot read, update or insert another workspace's records. Database checks also prove that password and MFA changes invalidate sessions, recovery tokens, pending MFA challenges and trusted-device records in the same transaction.

The scenario additionally persists lead conversion and pipeline edits through targeted dependency graphs, verifies connection-table tenant policies, and checks credential deletion on membership revocation. These are integrity and bounded-query checks, not a production load/soak benchmark.

Test fixtures are generic and isolated from the empty application initializer. PostgreSQL role-creation tests must run only against a disposable development/CI database. The migration retains the old workspace JSON as a rollback archive; current operations use the record store.

Microsoft token exchange/refresh uses mocked provider responses in automated tests. Encryption tests cover tampering and cross-user/workspace decryption failure. Production SMTP inbox delivery/bounces, enterprise SSO, organization-enforced MFA and audited lost-factor recovery remain unverified or unimplemented. Local email previews are private files, allowed only with a loopback application URL.

Live Microsoft consent, mailbox/calendar compatibility, publisher consent and enterprise tenant policies have not been verified; they require a configured Entra app/test tenant. No sending or calendar writes are implemented.

GitHub Actions is configured to repeat unit, database and production browser checks with disposable PostgreSQL 17. Its hosted result is separate from this local verification record.

This is not certification of parity with Salesforce or Microsoft Dynamics 365. See [enterprise release gates](enterprise-release-gates.md) for open work: remaining compatibility reads and workspace-wide concurrency, daily sales productivity, production email/SSO/lost-factor recovery, integrations, financial posting, production operations and a validated customer pilot.
