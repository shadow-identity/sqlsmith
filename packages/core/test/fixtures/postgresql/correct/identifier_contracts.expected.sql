-- C6A-GRAPH / R6A-04: schema-aware identifiers use one graph and SQL display contract.
CREATE TABLE public.users (
    id BIGINT PRIMARY KEY
);

CREATE TABLE audit.users (
    id BIGINT PRIMARY KEY
);

CREATE TABLE "tenant.one"."Users" (
    id BIGINT PRIMARY KEY
);

CREATE TABLE audit.orders (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id)
);

CREATE TABLE events (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id)
);
