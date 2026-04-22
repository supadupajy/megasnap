-- 서울 반포 지역 좌표 설정
WITH banpo_coord AS (
  SELECT 37.5088 as lat, 127.0016 as lng
),
-- 랜덤 유저 선택
random_user AS (
  SELECT id, nickname FROM public.profiles ORDER BY random() LIMIT 1
),
-- 랜덤 조건 결정 (일반, 인기, 광고, 골드, 다이아몬드 중 하나)
condition_type AS (
  SELECT type FROM (
    SELECT 'normal' as type UNION ALL
    SELECT 'popular' as type UNION ALL
    SELECT 'ad' as type UNION ALL
    SELECT 'gold' as type UNION ALL
    SELECT 'diamond' as type
  ) t ORDER BY random() LIMIT 1
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
    WHEN ct.type = 'ad' THEN '[AD] 반포 한강공원에서 즐기는 특별한 피크닉!'
    WHEN ct.type = 'popular' THEN '반포 무지개 분수 야경 정말 예뻐요! 꼭 보세요.'
    ELSE '반포에서의 여유로운 오후 ✨'
  END,
  '서울 서초구 반포동',
  lat + (random() - 0.5) * 0.005,
  lng + (random() - 0.5) * 0.005,
  'https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?auto=format&fit=crop&w=1200&q=90',
  'place',
  CASE 
    WHEN ct.type = 'popular' THEN floor(random() * 5000 + 10000)::int
    ELSE floor(random() * 500)::int
  END,
  now()
FROM banpo_coord, random_user u, condition_type ct;