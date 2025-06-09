CREATE TABLE baz (
    id INT,
    bar_ref VARCHAR(255),
    FOREIGN KEY (bar_ref) REFERENCES bar(b)
); 