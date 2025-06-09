CREATE TABLE alpha_currencies (
    code CHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(5)
);

CREATE TABLE yankee_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE
);

CREATE TABLE zebra_countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
