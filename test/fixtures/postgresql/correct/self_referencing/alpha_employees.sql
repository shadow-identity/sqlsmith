CREATE TABLE alpha_employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    manager_id INTEGER,
    FOREIGN KEY (manager_id) REFERENCES alpha_employees(id)
); 