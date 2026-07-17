CREATE TABLE users (
    id SERIAL PRIMARY KEY
);

CREATE INDEX idx_ghosts_name ON ghosts (name);
