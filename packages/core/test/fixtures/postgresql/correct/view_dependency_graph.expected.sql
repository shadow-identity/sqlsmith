-- C6B-NESTED / C6B-CTE / C6B-RELATION / R6B-01 / R6B-02 / R6B-03
CREATE TABLE public.users (
    id INTEGER PRIMARY KEY
);

CREATE TABLE audit.users (
    id INTEGER PRIMARY KEY
);

CREATE TABLE sales.orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER
);

CREATE VIEW audit.base_users AS
SELECT id FROM public.users;

CREATE VIEW audit.report AS
WITH base AS (
    SELECT * FROM audit.base_users
)
SELECT b.id
FROM base b
JOIN sales.orders o ON o.user_id = b.id;

CREATE VIEW audit.combined_users AS
SELECT id FROM audit.base_users
UNION ALL (SELECT id FROM audit.users)
UNION (SELECT id FROM public.users);
