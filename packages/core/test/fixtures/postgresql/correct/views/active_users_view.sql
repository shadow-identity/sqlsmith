CREATE VIEW active_users AS
SELECT id, name, email, created_at
FROM users
WHERE active = true; 