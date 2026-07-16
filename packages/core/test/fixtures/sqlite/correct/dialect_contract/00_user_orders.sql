CREATE VIEW "user_orders" AS
SELECT o.id
FROM "orders" o
JOIN "users" u ON u.id = o.user_id;
