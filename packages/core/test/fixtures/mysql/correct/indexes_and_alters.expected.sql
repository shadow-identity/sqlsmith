CREATE TABLE a (
    x INTEGER
);

CREATE TABLE b (
    y INTEGER
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY
);

CREATE INDEX idx_name ON a (x);

CREATE INDEX idx_name ON b (y);

ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id);
