-- VACUUM 제외하고 ANALYZE와 인덱스 최적화만 진행
DROP POLICY IF EXISTS "Allow public read access" ON public.posts;
CREATE POLICY "Allow public read access" ON public.posts FOR SELECT USING (true);

DROP INDEX IF EXISTS idx_posts_user_id;
CREATE INDEX idx_posts_user_id ON public.posts(user_id);

ANALYZE public.posts;
ANALYZE public.profiles;
