CREATE VIEW active_users AS
SELECT id, name, email, created_at
FROM users
WHERE active = true;

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