CREATE TABLE alpha_cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region_id INTEGER,
    FOREIGN KEY (region_id) REFERENCES yankee_regions(id)
); 