CREATE TABLE zulu_companies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country_code TEXT,
    currency_code TEXT,
    main_department_id INTEGER,
    FOREIGN KEY (country_code) REFERENCES zebra_countries(code),
    FOREIGN KEY (currency_code) REFERENCES yankee_currencies(code),
    FOREIGN KEY (main_department_id) REFERENCES xray_departments(id)
); 