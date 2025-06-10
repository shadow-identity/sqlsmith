CREATE TABLE xray_companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    headquarters_city_id INTEGER,
    FOREIGN KEY (headquarters_city_id) REFERENCES york_cities(id)
); 