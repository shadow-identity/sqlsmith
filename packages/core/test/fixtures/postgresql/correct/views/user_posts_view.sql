CREATE VIEW user_posts AS
SELECT 
    u.name as author_name,
    u.email as author_email,
    p.title,
    p.content,
    p.created_at
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE p.published = true; 