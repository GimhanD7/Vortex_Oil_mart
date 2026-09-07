# Security And Health Review

Review date: 2026-09-08. Scope: local source, dependencies, PHP API integration, production build, catalog/import changes, and deployment contents. This is not a complete penetration test or an audit of the live cPanel server.

## Important Remaining Actions

- **Rotate exposed production credentials.** Earlier Git history contains a database credential in the old PHP configuration and a debug ZIP. Current source cleanup and `.gitignore` do not revoke it or erase history. The hosted password was not changed by this work. Follow the [OWASP secrets lifecycle guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html). History was not rewritten or force-pushed.
- Existing user passwords were preserved. Change any publicly known/default credentials still used by real accounts. New/changed passwords must be 12-72 bytes.
- Deploy only the prepared runtime folder and private production configuration. Confirm HTTPS, Apache denial rules, database permissions, and session behavior on the actual host.
- Whole-project ESLint still reports 23 errors and 20 warnings in existing dashboard/returns code (explicit `any`, hook/function ordering, and JSX text). These were not hidden by relaxing the application lint rules. Type checking and compilation pass, but lint cleanup remains.

## Changes Included In Git

| Area | Included files |
| --- | --- |
| Frontend catalog | `src/components/PosCatalog.tsx`, admin products page, cashier dashboard, shared CSS |
| Frontend authentication | Login page, `src/lib/api-client.ts`, admin user password field, service-worker cache version |
| API security | `api/config.php`, new `environment.php` and `session.php`, authentication middleware/routes, central route authorization, users/inventory/sales protections |
| CSV imports | `api/product-import.php`, product/taxonomy routes, importer regression tests |
| Database tooling | Environment-driven setup scripts, fresh schema without demo data/default credentials, guarded local reset script |
| Deployment and checks | `.gitignore`, root/API/public `.htaccess`, safe `.env.example`, Next/build configuration, lint tooling scope, secret/security checks, cPanel packaging script, README and these guides |
| Project instructions | Next-generated `AGENTS.md` and `CLAUDE.md` |

Deleted from the tracked tree: the public database debug PHP/ZIP and five unused Next.js starter SVGs. Source files, build tools, regression tests, and private database backups needed for recovery were retained.

Never push populated `.env` files, `.local-backups` SQL files, `.local-checks`, `.oil-mart-db`, `node_modules`, `.next`, `out`, or `build`. Only the empty `api/.env.example` and the backup-folder denial `.htaccess` are intentional exceptions. Build artifacts go to cPanel, not Git.

## Security Improvements

- Database credentials and signing secret load from private environment configuration, with no production fallback values. Generic public errors replace connection/SQL details.
- Session cookies are HttpOnly, SameSite=Lax, and Secure in production. Tokens are no longer returned to/stored by browser JavaScript. Logout revokes the server session; account status and current permissions are checked on requests.
- API permissions block cashier-only accounts from product/inventory/customer/settings administration. Sales use the authenticated cashier and require that cashier's open sales cycle. Product prices are locked while totals are calculated.
- Login and supervisor credential attempts are rate-limited. Inactive administrators cannot approve protected actions. Cross-origin/cross-site unsafe browser requests are rejected.
- Apache blocks private environment files, direct helper/route access, debug archives, source directories, and database dumps. The same protections are included in the exported website configuration.

## Verification

- Production build: passed, including TypeScript validation and 21 exported pages; no static-export rewrite warning.
- Dependency audit: zero reported vulnerabilities at review time; this is not a guarantee against unknown vulnerabilities.
- PHP import tests: passed parsing, validation, duplicate handling, upsert, blank values, stock history, and rollback.
- API integration tests: passed permitted reads, forbidden cashier writes, cookie flags, cross-site rejection, inactive accounts, live permissions, cashier impersonation rejection, logout replay rejection, rate limiting, and private-file protection.
- Catalog browser tests: the responsive hierarchy/search/cart checks are run locally with browser-only stock/shift fixtures, not real sales. Hosted payment processing and physical tablet/PWA installation are not certified by these checks.
- Secret scanning examines current/staged source and private-file exclusions; it is pattern-based and cannot certify every historical commit or third-party service.

See `CPANEL_DEPLOYMENT.md` for the exact upload and cleanup steps.
