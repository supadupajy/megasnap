-- 타입 불일치 및 정책 의존성 때문에 테이블 직접 수정이 어려운 상황입니다.
-- 이를 해결하기 위해 '조인된 뷰(View)'를 생성하여 프론트엔드에서 편하게 사용할 수 있도록 합니다.

DROP VIEW IF EXISTS public.posts_with_profiles;

CREATE OR REPLACE VIEW public.posts_with_profiles AS
SELECT 
    p.*,
    pr.nickname as user_nickname,
    pr.avatar_url as user_avatar_url
FROM 
    public.posts p
LEFT JOIN 
    public.profiles pr ON p.user_id::uuid = pr.id;

-- 뷰 권한 설정
GRANT SELECT ON public.posts_with_profiles TO authenticated;
GRANT SELECT ON public.posts_with_profiles TO anon;

-- 확인
SELECT 1;
