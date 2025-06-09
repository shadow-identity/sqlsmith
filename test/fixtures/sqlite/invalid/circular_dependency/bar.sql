CREATE TABLE bar (
    id INTEGER,
    b TEXT,
    FOREIGN KEY (b) REFERENCES foo(a)
); 