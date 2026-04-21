-- 1. post-images 버킷 생성
INSERT INTO storage.buckets (id, name, public)
SELECT 'post-images', 'post-images', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'post-images'
);

-- 2. post-images 버킷에 대한 정책 설정
-- 모든 사용자 읽기 허용
DROP POLICY IF EXISTS "Post Images Public Access" ON storage.objects;
CREATE POLICY "Post Images Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'post-images');

-- 인증된 사용자 업로드 허용
DROP POLICY IF EXISTS "Post Images Authenticated Upload" ON storage.objects;
CREATE POLICY "Post Images Authenticated Upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images');

-- 3. 기존 post-videos 버킷 정책도 안전하게 확인
DROP POLICY IF EXISTS "Post Videos Public Access" ON storage.objects;
CREATE POLICY "Post Videos Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'post-videos');

DROP POLICY IF EXISTS "Post Videos Authenticated Upload" ON storage.objects;
CREATE POLICY "Post Videos Authenticated Upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-videos');
