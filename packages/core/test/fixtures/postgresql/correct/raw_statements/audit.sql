CREATE TABLE audit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO audit (user_id) VALUES (1);
