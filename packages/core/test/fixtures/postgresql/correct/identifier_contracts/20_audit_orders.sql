CREATE TABLE audit.orders (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id)
);
