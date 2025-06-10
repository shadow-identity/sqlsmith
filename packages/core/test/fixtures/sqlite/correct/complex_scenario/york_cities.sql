CREATE TABLE york_cities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
); 