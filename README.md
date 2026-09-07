# Oil Mart POS

Oil Mart POS is a Next.js admin and cashier system for oil and spare-parts stores.

## Main Features

- Admin dashboard with revenue, orders, stock alerts, recent sales, and top products.
- POS billing with cart, customers, saved payment methods, tax, invoice preview, and stock deduction.
- Product, customer, user, sales, inventory, purchase, report, and settings modules.
- Inventory movement history for sales, purchases, and manual stock adjustments.
- Purchase receiving with stock increase, edit, cancel, delete, and CSV export.
- Settings for store profile, invoice/payment settings, JSON backup export, and full backup import.

## Setup

Install dependencies:

```bash
npm install
```

Start Apache and MySQL from XAMPP. Use Node.js 22 or newer for the setup tools and PHP 8.1 or newer with PDO MySQL.

Create a private `api/.env` using the variable names in `api/.env.example`. Set `APP_ENV=local` and your local database connection. Generate a unique secret with the command below and put its output in `JWT_SECRET` (never commit it):

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

For a new database, provide `INITIAL_ADMIN_USERNAME` and a unique `INITIAL_ADMIN_PASSWORD` in that private file. The password must be 12-72 bytes. Optional `INITIAL_CASHIER_*` variables create a cashier. Remove these provisioning values after setup. Existing accounts are not overwritten, and no demo business data is inserted.

Create the database tables:

```bash
npm run db:setup
npm run db:inventory
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Database Environment

PHP and the setup scripts read `api/.env`, or the file named by the server's `OIL_MART_ENV_FILE` environment variable. Explicit process environment values take precedence. There are no production database credentials or JWT fallback secrets in source files. Production requires a database password and HTTPS.

Only the empty `api/.env.example` belongs in Git. Actual `.env` files, database backups, generated builds, and local test output are ignored. Never use `NEXT_PUBLIC_` for passwords, API secrets, or JWT signing keys because those values enter the browser bundle.

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run check:types
npm run test:security
npm run check:secrets
npm run package:cpanel
npm run db:setup
npm run db:inventory
```

## Notes

- Start MySQL before signing in.
- Run `npm run db:setup` after a fresh clone, then run `npm run db:inventory` when inventory, purchase, or sales columns are missing.
- The login API no longer uses a demo fallback when the database is unavailable.
- The integration security test creates temporary users in the local database and removes them afterwards. Do not point it at production.
- `check:secrets` scans staged Git content; it does not scrub earlier commits.
- For cPanel, build first, then run `package:cpanel` and follow `docs/CPANEL_DEPLOYMENT.md`. Do not upload the project root or run the local catalog reset on the hosted database.
