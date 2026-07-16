CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE INDEX idx_users_name ON users (name);

ALTER TABLE users ADD COLUMN age INTEGER;

INSERT INTO users (name) VALUES ('admin');
