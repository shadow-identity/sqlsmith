CREATE TABLE victor_products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer_company_id INTEGER,
    FOREIGN KEY (manufacturer_company_id) REFERENCES xray_companies(id)
); 