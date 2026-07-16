CREATE VIEW audit.report AS
WITH base AS (
    SELECT * FROM audit.base_users
)
SELECT b.id
FROM base b
JOIN sales.orders o ON o.user_id = b.id;
