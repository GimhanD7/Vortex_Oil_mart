-- Read-only diagnostics. Select the live POS database in phpMyAdmin first.
SHOW INDEX FROM sub_categories;
SHOW INDEX FROM categories;
SHOW INDEX FROM brands;

SELECT category_name, name, COUNT(*) AS copies
FROM sub_categories
GROUP BY category_name, name
HAVING COUNT(*) > 1;

SELECT name, COUNT(*) AS copies FROM categories GROUP BY name HAVING COUNT(*) > 1;
SELECT name, COUNT(*) AS copies FROM brands GROUP BY name HAVING COUNT(*) > 1;
