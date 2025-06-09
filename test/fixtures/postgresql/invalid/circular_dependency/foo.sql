CREATE TABLE foo (
    a VARCHAR(255),
    baz_ref VARCHAR(255),
    FOREIGN KEY (baz_ref) REFERENCES baz(id)
); 