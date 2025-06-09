CREATE TABLE xray_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    headquarters_city_id INTEGER,
    FOREIGN KEY (headquarters_city_id) REFERENCES york_cities(id)
); 