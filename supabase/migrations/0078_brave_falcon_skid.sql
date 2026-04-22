-- 5개 지역 좌표 설정
WITH areas AS (
  SELECT '서울 강남구 논현동' as name, 37.5115 as lat, 127.0285 as lng UNION ALL
  SELECT '서울 강남구 신사동' as name, 37.5240 as lat, 127.0229 as lng UNION ALL
  SELECT '서울 강남구 압구정동' as name, 37.5300 as lat, 127.0360 as lng UNION ALL
  SELECT '서울 강남구 역삼동' as name, 37.5006 as lat, 127.0364 as lng UNION ALL
  SELECT '서울 강남구 삼성동' as name, 37.5140 as lat, 127.0565 as lng
),
-- 랜덤 유저들 선택
random_users AS (
  SELECT id, nickname, row_number() over(order by random()) as rn
  FROM public.profiles 
  LIMIT 5
),
-- 랜덤 조건들 리스트
conditions AS (
  SELECT type, row_number() over(order by random()) as rn
  FROM (
    SELECT 'normal' as type UNION ALL
    SELECT 'popular' as type UNION ALL
    SELECT 'ad' as type UNION ALL
    SELECT 'gold' as type UNION ALL
    SELECT 'diamond' as type
  ) t
)
INSERT INTO public.posts (
  user_id, 
  user_name,
  content, 
  location_name, 
  latitude, 
  longitude, 
  image_url, 
  category, 
  likes, 
  created_at
)
SELECT 
  u.id,
  u.nickname,
  CASE 
    WHEN c.type = 'ad' THEN '[AD] ' || a.name || ' 핫플레이스 오픈! 지금 바로 방문하세요.'
    WHEN c.type = 'popular' THEN a.name || '에서 보낸 환상적인 시간 🔥 #HOT'
    ELSE a.name || ' 나들이 중 📸'
  END,
  a.name,
  a.lat + (random() - 0.5) * 0.002,
  a.lng + (random() - 0.5) * 0.002,
  'https://images.unsplash.com/photo-' || 
  (CASE (floor(random()*5)::int)
    WHEN 0 THEN '1514933651103-005eec06c04b'
    WHEN 1 THEN '1493397212122-2b85defad300'
    WHEN 2 THEN '1533174072545-7a4b6ad7a6c3'
    WHEN 3 THEN '1516450360452-9312f5e86fc7'
    ELSE '1464822759023-fed622ff2c3b'
  END) || '?auto=format&fit=crop&w=1200&q=90',
  'place',
  CASE 
    WHEN c.type = 'popular' THEN floor(random() * 5000 + 10000)::int
    ELSE floor(random() * 800)::int
  END,
  now()
FROM (SELECT *, row_number() over() as rn FROM areas) a
JOIN random_users u ON a.rn = u.rn
JOIN conditions c ON a.rn = c.rn;