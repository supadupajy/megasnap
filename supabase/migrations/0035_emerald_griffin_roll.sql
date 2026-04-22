-- 1. 문제가 되는 트리거를 즉시 삭제하여 서버 부하를 제거합니다.
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- 2. 관련 함수도 삭제합니다.
DROP FUNCTION IF EXISTS public.handle_profile_update();

-- 3. posts 테이블의 user_id 인덱스가 없다면 생성하여 조회 성능을 높입니다.
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);

-- 4. DB 통계를 다시 한 번 갱신합니다.
ANALYZE public.posts;
ANALYZE public.profiles;
ANALYZE public.follows;
ANALYZE public.saved_posts;
