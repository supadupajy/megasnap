-- 최근 생성된 '탐험가' 이름의 강남 지역 포스팅 20개를 삭제합니다.
DELETE FROM posts 
WHERE id IN (
  SELECT id 
  FROM posts 
  WHERE user_name = '탐험가' 
    AND (location_name LIKE '%강남구%' OR location_name LIKE '%서초%' OR location_name LIKE '%잠실%' OR location_name LIKE '%성수%')
  ORDER BY created_at DESC 
  LIMIT 20
);
