-- viewed_posts 테이블의 RLS 정책 재설정
DROP POLICY IF EXISTS "Users can record their own views" ON public.viewed_posts;

-- INSERT 시 WITH CHECK를 사용하여 데이터 저장 권한 확보
CREATE POLICY "Users can record their own views" ON public.viewed_posts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- UPSERT(UPDATE) 상황을 대비한 UPDATE 정책 추가
DROP POLICY IF EXISTS "Users can update their own views" ON public.viewed_posts;
CREATE POLICY "Users can update their own views" ON public.viewed_posts
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SELECT 정책 확인
DROP POLICY IF EXISTS "Users can see their own viewed history" ON public.viewed_posts;
CREATE POLICY "Users can see their own viewed history" ON public.viewed_posts
FOR SELECT TO authenticated USING (auth.uid() = user_id);
