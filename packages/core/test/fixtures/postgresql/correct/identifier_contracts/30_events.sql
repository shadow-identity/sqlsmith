CREATE TABLE events (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id)
);
