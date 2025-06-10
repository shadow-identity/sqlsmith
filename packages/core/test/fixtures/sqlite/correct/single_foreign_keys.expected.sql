CREATE TABLE zebra_countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE yankee_regions (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
);
