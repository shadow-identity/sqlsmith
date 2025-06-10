CREATE TABLE zebra_countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE yankee_regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2),
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
);

CREATE TABLE alpha_cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region_id INTEGER,
    FOREIGN KEY (region_id) REFERENCES yankee_regions(id)
);
