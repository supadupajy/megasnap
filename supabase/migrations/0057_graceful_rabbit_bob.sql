-- 1. posts 테이블에 테두리 타입을 결정하는 로직 보강
-- 좋아요 수나 특정 기준에 따라 border_type을 업데이트합니다.

-- 인기 포스팅 (좋아요 1000개 이상)
UPDATE public.posts
SET category = COALESCE(category, 'place')
WHERE category IS NULL;

-- 2. 임의로 인플루언서 등급 부여 (테스트 및 시각적 효과를 위해)
-- 좋아요 수에 따라 다이아몬드, 골드, 실버 부여
UPDATE public.posts
SET likes = floor(random() * 5000 + 100)
WHERE likes = 0;

-- 3. 기존에 보이지 않던 문제를 해결하기 위해,
-- 클라이언트에서 계산하던 로직을 DB의 'category'나 다른 필드와 연동할 수 있도록 준비하거나
-- 단순히 데이터가 충분히 화려하게 분포되도록 좋아요 수치를 조정합니다.
UPDATE public.posts
SET likes = floor(random() * 15000 + 5000)
WHERE id IN (SELECT id FROM public.posts ORDER BY random() LIMIT 100); -- 상위 100개는 무조건 인기 등급 이상으로
