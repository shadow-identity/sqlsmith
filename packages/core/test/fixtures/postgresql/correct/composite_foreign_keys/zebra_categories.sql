CREATE TABLE zebra_categories (
    category_code VARCHAR(10),
    subcategory_code VARCHAR(10),
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_code, subcategory_code)
); 