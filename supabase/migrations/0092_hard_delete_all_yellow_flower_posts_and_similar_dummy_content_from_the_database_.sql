-- 1. 강남 지역의 최근 포스팅 중 꽃 이미지와 관련된 모든 데이터를 삭제합니다.
DELETE FROM posts 
WHERE image_url LIKE '%pixabay.com/photo/2017/01/26/02/06/platter-2009590_1280.jpg%' -- 이전에 포함되었던 특정 이미지 링크 패턴
   OR image_url LIKE '%cdn.pixabay.com/photo/2016/11/29/03/40/architecture-1867114_1280.jpg%'
   OR image_url LIKE '%cdn.pixabay.com/photo/2017/12/10/17/40/seoul-3010309_1280.jpg%';

-- 2. 생성 시간 기준 최근 1시간 내의 모든 '탐험가' 포스팅 삭제
DELETE FROM posts 
WHERE user_name = '탐험가' 
  AND created_at > now() - interval '1 hour';
