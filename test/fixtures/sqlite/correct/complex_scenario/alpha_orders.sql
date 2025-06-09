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