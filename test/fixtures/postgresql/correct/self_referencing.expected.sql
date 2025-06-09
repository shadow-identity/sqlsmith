CREATE TABLE alpha_employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    manager_id INTEGER,
    FOREIGN KEY (manager_id) REFERENCES alpha_employees(id)
);

CREATE TABLE zebra_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_category_id INTEGER,
    FOREIGN KEY (parent_category_id) REFERENCES zebra_categories(id)
);
