CREATE VIEW audit.combined_users AS
SELECT id FROM audit.base_users
UNION ALL (SELECT id FROM audit.users)
UNION (SELECT id FROM public.users);
