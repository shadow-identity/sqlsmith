CREATE TABLE alpha_currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT
);

CREATE TABLE yankee_departments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE
);

CREATE TABLE zebra_countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
