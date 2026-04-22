-- 최근 생성된 꽃 이미지(노란색) 포스팅들을 모두 삭제합니다.
DELETE FROM posts 
WHERE user_name = '탐험가' 
  AND (location_name LIKE '%강남구%' OR location_name LIKE '%서초%' OR location_name LIKE '%잠실%' OR location_name LIKE '%성수%')
  AND created_at > now() - interval '30 minutes';
