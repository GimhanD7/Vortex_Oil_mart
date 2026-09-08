# Repeated Subcategories On Hosting

The previous category, brand and subcategory GET handlers ran `INSERT IGNORE ... SELECT DISTINCT ... FROM products` on every refresh. `INSERT IGNORE` only prevents matching-name duplicates when the database has the appropriate unique constraint. `CREATE TABLE IF NOT EXISTS` does not add missing indexes to an already-existing table.

This explains the symptom on an older hosted schema without those indexes; the live schema has not been inspected directly. Run the read-only statements in `scripts/check_hosted_taxonomy.sql` in phpMyAdmin with the POS database selected to confirm. Expected uniqueness is `categories(name)`, `brands(name)`, and `sub_categories(category_name, name)` (either column order). An ID primary key alone is insufficient.

## PHP-Only Patch

Back up the existing API files, then overwrite these paths under the website document root:

- `api/routes/categories.php`
- `api/routes/brands.php`
- `api/routes/sub_categories.php`
- `api/product-import.php`

The patch removes row insertion from GET handlers, returns one canonical entry per name (per category for subcategories), and checks existing names before explicit creation/import. No frontend rebuild or `.env` change is needed. Reload the page while online so the new API result replaces any browser-cached list. If the host retains old PHP bytecode, ask the provider to invalidate OPcache/restart the site's PHP workers.

## Existing Database Rows

The patch does not delete any stored rows, products, stock, invoices, or sales. Existing duplicate names are grouped in the API response. Database cleanup and restoring unique indexes should be a separate backed-up migration after inspecting the live schema and any foreign keys. Do not reset the database or blindly delete duplicate IDs. Application existence checks alone do not replace unique constraints for concurrent writes.

Verification: temporary-table tests reproduce a legacy schema without unique indexes, assert no GET row insertion, check duplicate POST behavior and category-scoped lists, and confirm repeated imports keep taxonomy row counts stable. The tests do not modify real catalog rows.
