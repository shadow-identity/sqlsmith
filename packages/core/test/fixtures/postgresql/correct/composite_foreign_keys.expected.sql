CREATE TABLE zebra_categories (
    category_code VARCHAR(10),
    subcategory_code VARCHAR(10),
    name VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_code, subcategory_code)
);

CREATE TABLE zulu_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_code VARCHAR(10),
    subcategory_code VARCHAR(10),
    FOREIGN KEY (category_code, subcategory_code) REFERENCES zebra_categories(category_code, subcategory_code)
);
