-- 1. user_roles 테이블에 데이터가 누락되었을 수 있으므로 다시 한번 확실히 삽입/업데이트
INSERT INTO public.user_roles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email IN ('supadupajy@gmail.com', 'supadupajy@naver.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 2. 삽입 결과 확인
SELECT ur.id, ur.role, au.email 
FROM public.user_roles ur
JOIN auth.users au ON ur.id = au.id
WHERE au.email IN ('supadupajy@gmail.com', 'supadupajy@naver.com');
