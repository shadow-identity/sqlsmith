CREATE SEQUENCE user_id_seq START 1000;
CREATE SEQUENCE post_id_seq START 1;

CREATE TABLE users (
    id INTEGER PRIMARY KEY DEFAULT nextval('user_id_seq'),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE VIEW active_users AS
SELECT id, name, email, created_at
FROM users
WHERE active = true;

CREATE TABLE posts (
    id INTEGER PRIMARY KEY DEFAULT nextval('post_id_seq'),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    user_id INTEGER NOT NULL,
    category_id INTEGER,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE VIEW published_posts AS
SELECT 
    p.id,
    p.title,
    p.content,
    u.name as author_name,
    c.name as category_name,
    p.created_at
FROM posts p
JOIN users u ON p.user_id = u.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.published = true; 