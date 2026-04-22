-- posts 테이블의 모든 제약 조건 및 트리거 확인
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled
FROM pg_trigger
WHERE tgrelid = 'public.posts'::regclass;

-- 혹은 posts 테이블의 상태를 확인하기 위한 임시 쿼리
SELECT count(*) FROM public.posts;
