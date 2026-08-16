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

Create and seed the database:

```bash
npm run db:start
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

## Default Users

- Admin: `admin` / `admin123`
- Cashier: `cashier` / `cashier123`

## Database Environment

The app uses MySQL. Defaults:

```text
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=oil_mart
```

## Useful Commands

```bash
npm run dev
npm run build
npm run lint
npm run db:setup
npm run db:inventory
```

## Notes

- Start MySQL before signing in.
- Run `npm run db:setup` after a fresh clone, then run `npm run db:inventory` when inventory, purchase, or sales columns are missing.
- The login API no longer uses a demo fallback when the database is unavailable.
