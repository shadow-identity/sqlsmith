CREATE TABLE baz (
    id INTEGER,
    bar_ref TEXT,
    FOREIGN KEY (bar_ref) REFERENCES bar(b)
); 