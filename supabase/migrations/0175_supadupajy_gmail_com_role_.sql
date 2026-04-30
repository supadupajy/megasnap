
SELECT au.id, au.email, ur.role, ur.created_at
FROM auth.users au
LEFT JOIN user_roles ur ON ur.id = au.id
WHERE au.email = 'supadupajy@gmail.com';
