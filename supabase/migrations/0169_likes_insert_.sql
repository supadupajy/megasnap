
-- 기존 INSERT 정책 삭제 후 USING 절 포함하여 재생성
DROP POLICY IF EXISTS "likes_insert_own" ON likes;

CREATE POLICY "likes_insert_own" ON likes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
