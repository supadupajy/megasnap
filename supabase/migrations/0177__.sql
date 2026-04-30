
SELECT au.email, ur.role, ur.created_at
FROM user_roles ur
JOIN auth.users au ON ur.id = au.id
WHERE au.email = 'supadupajy@gmail.com';
