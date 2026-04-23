-- 1. youtube_url이 NULL인 포스트들을 찾아서 샘플 유튜브 링크로 업데이트합니다.
-- 다양한 카테고리에 맞춰 서로 다른 유튜브 링크를 할당합니다.

-- 맛집 관련 (food)
UPDATE public.posts 
SET youtube_url = 'https://www.youtube.com/watch?v=js1CtxSY38I' 
WHERE youtube_url IS NULL AND category = 'food';

-- 동물 관련 (animal)
UPDATE public.posts 
SET youtube_url = 'https://www.youtube.com/watch?v=Hbb5GPxXF1w' 
WHERE youtube_url IS NULL AND category = 'animal';

-- 명소/장소 관련 (place)
UPDATE public.posts 
SET youtube_url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' 
WHERE youtube_url IS NULL AND category = 'place';

-- 사고/사건 관련 (accident)
UPDATE public.posts 
SET youtube_url = 'https://www.youtube.com/watch?v=M7lc1UVf-VE' 
WHERE youtube_url IS NULL AND category = 'accident';

-- 그 외 남은 NULL 값들을 기본 영상으로 채움 (인기 동영상 등에서 활용되도록)
UPDATE public.posts 
SET youtube_url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' 
WHERE youtube_url IS NULL;

-- 2. 잘 채워졌는지 확인 (로그 출력용)
SELECT count(*) FROM public.posts WHERE youtube_url IS NOT NULL;
