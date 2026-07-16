-- Child table, references parent
CREATE TABLE child (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES parent(id)
);
