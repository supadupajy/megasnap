
-- UPDATE 정책 추가 (upsert 시 필요)
DROP POLICY IF EXISTS "likes_update_own" ON likes;
CREATE POLICY "likes_update_own" ON likes
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
