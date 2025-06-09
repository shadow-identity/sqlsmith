CREATE TABLE bar (
    id INT,
    b VARCHAR(255),
    FOREIGN KEY (b) REFERENCES foo(a)
); 