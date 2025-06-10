CREATE TABLE yankee_regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2),
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
); 