
SELECT ur.id, ur.role, ur.created_at, au.email 
FROM user_roles ur
JOIN auth.users au ON ur.id = au.id
WHERE au.email = 'supadupajy@naver.com';
