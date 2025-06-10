CREATE TABLE zulu_products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category_code TEXT,
    subcategory_code TEXT,
    FOREIGN KEY (category_code, subcategory_code) REFERENCES zebra_categories(category_code, subcategory_code)
); 