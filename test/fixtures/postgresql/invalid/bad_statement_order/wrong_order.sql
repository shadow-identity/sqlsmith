-- This file intentionally has CREATE TABLE statements in wrong order
-- cities depends on countries, but cities comes first - this should trigger an error

CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2),
    FOREIGN KEY (country_code) REFERENCES countries(code)
);

-- This should come BEFORE cities since cities depends on it
CREATE TABLE countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
); 