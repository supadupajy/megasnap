-- 1. 가장 가벼운 정책으로 SELECT 허용 (서브쿼리 배제)
DROP POLICY IF EXISTS "Allow public read access" ON public.posts;
CREATE POLICY "Allow public read access" ON public.posts FOR SELECT USING (true);

-- 2. 인덱스 최적화 (성능 병목 해결)
CREATE INDEX IF NOT EXISTS idx_posts_user_id_desc ON public.posts (user_id, created_at DESC);

-- 3. 통계 정보만 갱신
ANALYZE public.posts;
