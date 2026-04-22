-- 최근 30분 내에 생성된 강남 및 주변 지역 특별 포스팅 20개를 삭제합니다.
DELETE FROM posts 
WHERE user_name = '탐험가' 
  AND (location_name LIKE '%강남구%' OR location_name LIKE '%서초%' OR location_name LIKE '%잠실%' OR location_name LIKE '%성수%')
  AND created_at > now() - interval '30 minutes';
