CREATE TABLE "users" (
    id INTEGER PRIMARY KEY
);

CREATE TABLE "orders" (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES "users"(id)
);

CREATE VIEW "user_orders" AS
SELECT o.id
FROM "orders" o
JOIN "users" u ON u.id = o.user_id;
