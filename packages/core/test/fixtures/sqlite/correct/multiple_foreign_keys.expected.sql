CREATE TABLE xray_departments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE
);

CREATE TABLE yankee_currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT
);

CREATE TABLE zebra_countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

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
