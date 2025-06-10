CREATE TABLE zebra_countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE york_cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country_code CHAR(2),
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code)
);

CREATE TABLE xray_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    headquarters_city_id INTEGER,
    FOREIGN KEY (headquarters_city_id) REFERENCES york_cities(id)
);

CREATE TABLE victor_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    manufacturer_company_id INTEGER,
    FOREIGN KEY (manufacturer_company_id) REFERENCES xray_companies(id)
);

CREATE TABLE whiskey_employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    company_id INTEGER,
    manager_id INTEGER,
    FOREIGN KEY (company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (manager_id) REFERENCES whiskey_employees(id)
);

CREATE TABLE alpha_orders (
    id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL,
    customer_company_id INTEGER,
    sales_employee_id INTEGER,
    product_id INTEGER,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (customer_company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (sales_employee_id) REFERENCES whiskey_employees(id),
    FOREIGN KEY (product_id) REFERENCES victor_products(id)
);
