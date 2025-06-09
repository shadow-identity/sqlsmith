CREATE TABLE zulu_companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    country_code CHAR(2),
    currency_code CHAR(3),
    main_department_id INTEGER,
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code),
    FOREIGN KEY (currency_code) REFERENCES yankee_currencies(code),
    FOREIGN KEY (main_department_id) REFERENCES xray_departments(id)
); 