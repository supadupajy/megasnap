-- 1. user_roles 테이블의 모든 내용 확인
SELECT ur.id, ur.role, au.email 
FROM public.user_roles ur
JOIN auth.users au ON ur.id = au.id;

-- 2. 현재 요청하신 이메일들이 auth.users에 존재하는지 확인
SELECT id, email FROM auth.users WHERE email IN ('supadupajy@gmail.com', 'supadupajy@naver.com');
