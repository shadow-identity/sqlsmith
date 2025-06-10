CREATE TABLE whiskey_employees (
    id INTEGER PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company_id INTEGER,
    manager_id INTEGER,
    FOREIGN KEY (company_id) REFERENCES xray_companies(id),
    FOREIGN KEY (manager_id) REFERENCES whiskey_employees(id)
); 