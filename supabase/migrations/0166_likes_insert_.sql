
-- 기존 INSERT 정책 삭제
DROP POLICY IF EXISTS "likes_insert_own" ON likes;

-- USING 절을 포함한 새 INSERT 정책 생성 (upsert 지원)
CREATE POLICY "likes_insert_own" ON likes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
