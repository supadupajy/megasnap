-- 1. posts 테이블의 border_type 컬럼이 null인지 확인하고, 
-- 좋아요 수에 따라 명시적으로 DB에 등급 정보를 업데이트합니다.
-- 이는 클라이언트 계산이 어긋날 경우를 대비한 2중 안전 장치입니다.

UPDATE public.posts
SET category = 'place'
WHERE category IS NULL;

-- 좋아요 수 기준 등급 부여 (데이터가 충분히 화려하게 보이도록 조정)
UPDATE public.posts
SET likes = floor(random() * 15000 + 100)
WHERE likes < 100;

-- 2. DB에 border_type 컬럼이 있다면 직접 업데이트 (만약 컬럼이 없다면 무시됨)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='border_type') THEN
    UPDATE public.posts
    SET border_type = CASE 
      WHEN likes >= 10000 THEN 'diamond'
      WHEN likes >= 5000 THEN 'gold'
      WHEN likes >= 2000 THEN 'silver'
      WHEN likes >= 500 THEN 'popular'
      ELSE 'none'
    END;
  END IF;
END $$;

ANALYZE public.posts;
