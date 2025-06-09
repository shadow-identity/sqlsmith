CREATE TABLE zebra_countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE york_cities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
);

CREATE TABLE xray_companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    headquarters_city_id INTEGER,
    FOREIGN KEY (headquarters_city_id) REFERENCES york_cities(id)
);

CREATE TABLE victor_products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer_company_id INTEGER,
    FOREIGN KEY (manufacturer_company_id) REFERENCES xray_companies(id)
);

CREATE TABLE whiskey_employees (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company_id INTEGER,
    manager_id INTEGER,
    FOREIGN KEY (company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (manager_id) REFERENCES whiskey_employees(id)
);

CREATE TABLE alpha_orders (
    id INTEGER PRIMARY KEY,
    order_date TEXT NOT NULL,
    customer_company_id INTEGER,
    sales_employee_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (customer_company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (sales_employee_id) REFERENCES whiskey_employees(id),
    FOREIGN KEY (product_id) REFERENCES victor_products(id)
);
