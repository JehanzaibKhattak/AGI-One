# AGI One verification

Verified locally on 25 October 2026 against PostgreSQL 15 and the Next.js 16.4.3 production build.

| Check | Result |
| --- | --- |
| Dependency audit after patches | Zero reported vulnerabilities |
| Unit/regression tests | 13 passed |
| TypeScript | Passed |
| ESLint | Passed without warnings |
| Production build | Passed |
| Production browser suite | Passed; 30 workspace routes and a 390px mobile viewport |
| Desktop/mobile visual inspection | Completed; dashboard spacing corrected |
| Database backup/restore | Full custom-format dump restored into a separate local database, including accounts, workspaces and audit events |

The browser suite exercises actual account creation, empty onboarding, persistent customer creation and reload, purchase approval and receiving, quote conversion, stock reservation and delivery, invoice issuance and payment. It verifies rejection of forged delivery status, cross-workspace writes, viewer writes and invitations, untrusted request origins, stale API revisions, stale open forms after background refresh, and simultaneous conflicting edits. It also verifies sign-out, denied requests after sign-out, incorrect passwords and successful password sign-in.

Two client-store regressions check that old requests cannot restore a previous account's workspace after sign-out. Test fixtures use generic examples isolated from the application's empty workspace initializer. No former business's dataset is used.

This verification is local, not certification of enterprise readiness. GitHub Actions is configured to repeat the checks with disposable PostgreSQL; its hosted result is separate from the local results above. Production deployment, provider-specific backup scheduling, load testing, email recovery/verification, accounting and privacy/tax compliance remain release work described in [the roadmap](release-roadmap.md).
