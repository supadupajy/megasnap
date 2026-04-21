-- user_id가 UUID 타입인 경우를 대비한 캐스팅 수정
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" ON public.posts
FOR DELETE TO authenticated USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users insert" ON public.posts;
CREATE POLICY "Authenticated users insert" ON public.posts
FOR INSERT TO authenticated WITH CHECK (user_id::text = auth.uid()::text);
