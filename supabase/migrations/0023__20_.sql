WITH locations AS (
  SELECT * FROM (VALUES
    ('강남역 맛집 탐방', 37.4979, 127.0276, 'food'),
    ('서초동 조용한 카페', 37.4877, 127.0174, 'place'),
    ('삼성역 코엑스 나들이', 37.5088, 127.0631, 'place'),
    ('강남구청 근처 산책', 37.5173, 127.0474, 'place'),
    ('반포 한강공원 피크닉', 37.5115, 127.0016, 'place'),
    ('양재 시민의 숲 가을', 37.4714, 127.0354, 'place'),
    ('가로수길 쇼핑중', 37.5208, 127.0227, 'place'),
    ('선릉역 맛있는 점심', 37.5045, 127.0490, 'food'),
    ('압구정 로데오 핫플', 37.5273, 127.0391, 'place'),
    ('청담동 고급 카페', 37.5251, 127.0481, 'food'),
    ('역삼동 테헤란로 야경', 37.5006, 127.0365, 'place'),
    ('논현동 먹자골목 소식', 37.5111, 127.0215, 'food'),
    ('도곡동 타워팰리스 산책', 37.4883, 127.0519, 'place'),
    ('개포동 양재천 풍경', 37.4832, 127.0604, 'place'),
    ('삼성동 봉은사 힐링', 37.5152, 127.0594, 'place'),
    ('강남 소방서 근처 사고주의', 37.5175, 127.0471, 'accident'),
    ('서초역 대법원 앞 산책', 37.4925, 127.0076, 'place'),
    ('신사역 가로수길 카페', 37.5163, 127.0202, 'food'),
    ('대치동 학원가 밤풍경', 37.4932, 127.0567, 'place'),
    ('일원동 조용한 마을', 37.4839, 127.0827, 'place')
  ) AS t(content, lat, lng, cat)
),
random_user AS (
  SELECT id, nickname, avatar_url FROM public.profiles LIMIT 1
)
INSERT INTO public.posts (
  user_id, 
  user_name, 
  user_avatar, 
  content, 
  latitude, 
  longitude, 
  location_name, 
  category, 
  likes, 
  created_at
)
SELECT 
  u.id, 
  u.nickname, 
  u.avatar_url, 
  l.content, 
  l.lat + (random() - 0.5) * 0.005, -- 미세한 랜덤 좌표 추가
  l.lng + (random() - 0.5) * 0.005, 
  split_part(l.content, ' ', 1), 
  l.cat, 
  floor(random() * 100)::int,
  NOW() - (random() * interval '24 hours')
FROM locations l, random_user u;