-- 해당 포스팅의 위치와 카테고리를 'place'(명소)로 업데이트
UPDATE posts 
SET latitude = 37.2662, 
    longitude = 127.0002, 
    location_name = '경기도 수원시 팔달구 매산로1가',
    category = 'place'
WHERE id = 'cebfd060-7116-4a6c-b259-b5bba3cb9d44';