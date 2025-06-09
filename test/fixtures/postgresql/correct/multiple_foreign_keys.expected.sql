CREATE TABLE xray_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE
);

CREATE TABLE yankee_currencies (
    code CHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(5)
);

CREATE TABLE zebra_countries (
    code CHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

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
