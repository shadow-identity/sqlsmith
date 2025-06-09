CREATE TABLE whiskey_employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    company_id INTEGER,
    manager_id INTEGER,
    FOREIGN KEY (company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (manager_id) REFERENCES whiskey_employees(id)
); 