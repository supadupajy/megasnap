-- posts 테이블에 video_url 컬럼 추가
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- post-videos 버킷이 없는 경우 생성 (존재 여부 확인 후 삽입)
INSERT INTO storage.buckets (id, name, public)
SELECT 'post-videos', 'post-videos', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'post-videos'
);

-- post-videos 버킷에 대한 정책 설정
-- 1. 공개 읽기 권한
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'post-videos');

-- 2. 인증된 사용자의 업로드 권한
CREATE POLICY "Authenticated Users Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-videos');

-- 3. 자신의 객체 수정 및 삭제 권한
CREATE POLICY "Users Update Own Objects" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'post-videos' AND auth.uid()::text = owner::text);
CREATE POLICY "Users Delete Own Objects" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-videos' AND auth.uid()::text = owner::text);
