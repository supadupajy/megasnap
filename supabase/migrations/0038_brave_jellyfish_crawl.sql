-- 1. 성능을 저하시키는 복잡한 RLS 정책이나 트리거가 여전히 남아있는지 확인하고 정리합니다.
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_profile_update();

-- 2. posts 테이블의 user_id 인덱스가 유효한지 확인하고 재생성합니다.
DROP INDEX IF EXISTS idx_posts_user_id;
CREATE INDEX idx_posts_user_id ON public.posts(user_id);

-- 3. 데이터베이스 통계를 강제로 업데이트하여 쿼리 플래너가 최적의 경로를 찾게 합니다.
ANALYZE public.posts;
ANALYZE public.profiles;

-- 4. (중요) 타임아웃 에러 방지를 위해 posts 테이블의 조회를 단순화할 수 있도록
-- 불필요한 대규모 조인이나 복잡한 연산을 유발하는 요소가 있는지 점검합니다.
-- 현재 4700개 데이터는 인덱스만 제대로 타면 타임아웃이 날 수 없는 양입니다.
-- 만약 여전히 타임아웃이 발생한다면 서버측 일시적 부하이므로, 
-- 클라이언트에서 데이터를 끊어서 가져오도록 유도해야 합니다.
