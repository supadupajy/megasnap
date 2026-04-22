-- 두 계정의 UUID 가져오기
WITH user_ids AS (
  SELECT id, nickname 
  FROM public.profiles 
  WHERE nickname IN ('엄마쟤흙먹어', '비트코인떡락')
)
-- 랜덤 대도시 좌표를 기반으로 20개(각 10개) 포스팅 생성
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
    WHEN (ROW_NUMBER() OVER(ORDER BY random())) % 5 = 0 THEN '[AD] ' || content_base.text
    ELSE content_base.text
  END as content,
  cities.name as location_name,
  cities.lat + (random() - 0.5) * 0.05 as latitude,
  cities.lng + (random() - 0.5) * 0.05 as longitude,
  'https://images.unsplash.com/photo-' || img_ids.id || '?auto=format&fit=crop&w=1200&q=90' as image_url,
  'place' as category,
  floor(random() * 500 + 50)::int as likes,
  now() - (random() * interval '7 days')
FROM user_ids u
CROSS JOIN (
  -- 대도시 좌표 리스트
  SELECT '서울 강남' as name, 37.4979 as lat, 127.0276 as lng UNION ALL
  SELECT '서울 홍대' as name, 37.5565 as lat, 126.9239 as lng UNION ALL
  SELECT '부산 해운대' as name, 35.1587 as lat, 129.1604 as lng UNION ALL
  SELECT '대구 동성로' as name, 35.8711 as lat, 128.6014 as lng UNION ALL
  SELECT '인천 송도' as name, 37.3851 as lat, 126.6425 as lng UNION ALL
  SELECT '광주 상무지구' as name, 35.1491 as lat, 126.8514 as lng UNION ALL
  SELECT '대전 둔산동' as name, 36.3504 as lat, 127.3845 as lng
) cities
CROSS JOIN (
  -- 다양한 문구 리스트
  SELECT '여기 분위기 진짜 최고네요!' as text UNION ALL
  SELECT '주말 나들이 장소로 추천합니다.' as text UNION ALL
  SELECT '오늘 날씨랑 너무 잘 어울리는 곳이에요.' as text UNION ALL
  SELECT '생각보다 한적해서 힐링하기 좋았어요.' as text UNION ALL
  SELECT '인생샷 건지기 딱 좋은 스팟 발견!' as text
) content_base
CROSS JOIN (
  -- 다양한 Unsplash 이미지 ID
  SELECT '1501785888041-af3ef285b470' as id UNION ALL
  SELECT '1470071459604-3b5ec3a7fe05' as id UNION ALL
  SELECT '1441974231531-c6227db76b6e' as id UNION ALL
  SELECT '1506744038136-46273834b3fb' as id UNION ALL
  SELECT '1511497584788-915e57d2c9c5' as id
) img_ids
ORDER BY random()
LIMIT 20;