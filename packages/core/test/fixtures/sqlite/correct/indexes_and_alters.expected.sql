CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

ALTER TABLE users ADD COLUMN age INTEGER;

CREATE INDEX idx_users_name ON users (name);
