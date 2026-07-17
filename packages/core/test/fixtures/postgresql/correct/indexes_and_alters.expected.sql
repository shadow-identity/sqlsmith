CREATE TABLE orgs (
    id SERIAL PRIMARY KEY
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    org_id INTEGER,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE "Users" (
    "Id" INTEGER PRIMARY KEY
);

ALTER TABLE users ADD CONSTRAINT users_org_fk FOREIGN KEY (org_id) REFERENCES orgs(id);

ALTER TABLE users ADD COLUMN age INTEGER;

CREATE INDEX idx_users_name ON users (name);

CREATE UNIQUE INDEX "Idx" ON "Users" ("Id");
