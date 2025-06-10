-- This file intentionally has CREATE TABLE statements in wrong order
-- cities depends on countries, but cities comes first - this should trigger an error

CREATE TABLE cities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    FOREIGN KEY (country_code) REFERENCES countries(code)
);

-- This should come BEFORE cities since cities depends on it
CREATE TABLE countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
); 