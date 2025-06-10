CREATE TABLE zebra_categories (
    category_code TEXT,
    subcategory_code TEXT,
    name TEXT NOT NULL,
    PRIMARY KEY (category_code, subcategory_code)
); 