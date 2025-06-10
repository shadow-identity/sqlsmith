CREATE TABLE foo (
    a TEXT,
    baz_ref TEXT,
    FOREIGN KEY (baz_ref) REFERENCES baz(id)
); 