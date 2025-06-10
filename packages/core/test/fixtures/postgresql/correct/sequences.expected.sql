CREATE SEQUENCE user_id_seq START 1;

CREATE TABLE users (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_id_seq'),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE
); 