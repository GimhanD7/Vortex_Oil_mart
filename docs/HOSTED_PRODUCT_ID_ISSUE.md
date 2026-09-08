# Hosted Product ID Issue

The screenshot shows `DELETE /api/products/0`. In the previous API, PHP treated string `"0"` as false, so the DELETE/PUT handler did not run. In the frontend, a numeric edit ID of zero selected POST instead of PUT, allowing an attempted edit to create another product.

The local database generates positive product IDs. Missing AUTO_INCREMENT or unique product ID keys on the hosted schema is a likely cause of zero/repeated IDs, especially alongside duplicate SKUs and subcategories. This cannot be confirmed or repaired safely from the screenshot alone.

## Safeguards Added

- Invalid or duplicate frontend product IDs cannot trigger edit/delete requests.
- Editing is distinguished from creating by `null`, not a truthiness check.
- API product writes reject invalid IDs and missing unique AUTO_INCREMENT ID configuration with an explicit 409 error.
- CSV imports also reject broken product identity configuration.
- Updating/deleting a missing positive ID returns 404 instead of reporting success.

These safeguards prevent further damage. They do **not** repair existing hosted IDs or make corrupted records editable. Normal update/delete behavior was tested against valid product IDs in temporary tables.

## Required Live Diagnosis

Back up the hosted database and pause billing and product/stock changes until product IDs are verified. In phpMyAdmin, select the POS database and run `scripts/check_hosted_product_ids.sql`. This is read-only and returns the table definition, indexes, invalid/duplicate IDs, duplicate SKUs, and declared product foreign keys. A screenshot of the products Structure/indexes view is also useful.

Do not renumber IDs, delete zero-ID rows, reset the database, or add a primary key blindly. Sales, purchase items, returns, and inventory movements may already reference these IDs. Repair must preserve those references; several products sharing one ID can make historical ownership ambiguous. Do not treat SKU as a replacement ID when the screenshot already shows duplicate SKUs.

Deploy the rebuilt frontend and updated `api/routes/products.php` plus `api/product-import.php` together. Include the earlier taxonomy PHP fixes if not yet installed. Keep the server `.env` and live database intact. The separate browser-listener console message is not sufficient evidence about the API failure; investigate the product request/response first.

The loose gram/kilogram enhancement is paused while this production issue is addressed.
