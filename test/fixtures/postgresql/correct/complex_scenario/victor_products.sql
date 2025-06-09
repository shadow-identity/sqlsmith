CREATE TABLE victor_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    manufacturer_company_id INTEGER,
    FOREIGN KEY (manufacturer_company_id) REFERENCES xray_companies(id)
); 