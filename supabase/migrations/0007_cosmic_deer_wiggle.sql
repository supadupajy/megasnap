-- post-images 버킷에 대한 정책 확인 및 재생성
-- 이미 존재할 수 있으므로 실패를 방지하기 위해 드롭 후 생성
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;

-- 모든 사용자 읽기 허용 (post-images, post-videos 모두 포함)
CREATE POLICY "Storage Public Access" ON storage.objects 
FOR SELECT USING (bucket_id IN ('post-images', 'post-videos'));

-- 인증된 사용자 업로드 허용
CREATE POLICY "Storage Authenticated Upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('post-images', 'post-videos'));
