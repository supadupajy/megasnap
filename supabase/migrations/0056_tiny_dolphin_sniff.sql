-- 강남 및 삼성 지역 (강남구 중심) 좌표 설정
-- 강남역 부근: 37.4979, 127.0276
-- 삼성역 부근: 37.5088, 127.0631

-- 포스팅 생성을 위한 임시 데이터를 생성하고 바로 삽입합니다.
-- 15개의 포스팅을 두 지역에 나누어 생성 (강남 8개, 삼성 7개)
INSERT INTO public.posts (
  content, 
  location_name, 
  latitude, 
  longitude, 
  image_url, 
  images, 
  user_id, 
  user_name, 
  user_avatar, 
  likes, 
  category, 
  created_at
)
SELECT 
  content_pool[floor(random() * 15 + 1)],
  location_pool[i],
  lat_pool[i] + (random() * 0.004 - 0.002), -- 미세 좌표 변동
  lng_pool[i] + (random() * 0.004 - 0.002),
  'https://images.unsplash.com/photo-' || img_pool[i] || '?auto=format&fit=crop&w=800&q=80&sig=' || gen_random_uuid(),
  ARRAY['https://images.unsplash.com/photo-' || img_pool[i] || '?auto=format&fit=crop&w=800&q=80&sig=' || gen_random_uuid()],
  (SELECT id FROM profiles ORDER BY random() LIMIT 1), -- 랜덤 유저 ID
  '탐험가',
  'https://i.pravatar.cc/150?u=' || gen_random_uuid(),
  floor(random() * 5000 + 100),
  category_pool[floor(random() * 4 + 1)],
  now() - (random() * interval '48 hours')
FROM 
  generate_series(1, 15) as i,
  (SELECT ARRAY[
    '여기 진짜 뷰 맛집이네요! 강남 한복판에서 힐링 중..✨',
    '삼성동 직장인들이 추천하는 찐 맛집 발견!',
    '와.. 오늘 날씨 강남역 거리 걷기 딱 좋네요.',
    '코엑스 별마당 도서관은 올 때마다 감탄하게 돼요. 📚',
    '강남역 사거리는 언제나 에너지가 넘치네요.',
    '여기 커피 진짜 맛있어요. 삼성동 오면 꼭 들러보세요.',
    '퇴근길 테헤란로 야경은 정말 예술입니다. 🌃',
    '주말 강남 나들이! 사람 정말 많지만 즐거워요.',
    '삼성역 근처 숨은 명소 공유합니다. 나만 알고 싶음!',
    '오늘 점심 메뉴 성공적! 강남 물가 비싸지만 여긴 가성비 최고.',
    '현대백화점 무역센터점 식품관 투어 중.. 배 터지겠어요.',
    '봉은사 산책하며 마음의 평화를 찾고 갑니다. 🙏',
    '강남대로 빌딩 숲 사이에서 발견한 작은 공원.',
    '삼성동 아쿠아리움 아이들이랑 오기 너무 좋네요.',
    '여기 분위기 미쳤어요. 데이트 코스로 강추!'
  ] as content_pool) as cp,
  (SELECT ARRAY[
    '서울특별시 강남구 역삼동', '서울특별시 강남구 서초동', '서울특별시 강남구 논현동', '서울특별시 강남구 삼성동',
    '서울특별시 강남구 대치동', '서울특별시 강남구 역삼동', '서울특별시 강남구 삼성동', '서울특별시 강남구 서초동',
    '서울특별시 강남구 삼성동', '서울특별시 강남구 삼성동', '서울특별시 강남구 대치동', '서울특별시 강남구 삼성동',
    '서울특별시 강남구 역삼동', '서울특별시 강남구 삼성동', '서울특별시 강남구 논현동'
  ] as location_pool) as lp,
  (SELECT ARRAY[
    37.4979, 37.4985, 37.5012, 37.5088, 37.5050, 37.4960, 37.5110, 37.4990,
    37.5100, 37.5070, 37.5040, 37.5120, 37.4950, 37.5095, 37.5020
  ] as lat_pool) as latp,
  (SELECT ARRAY[
    127.0276, 127.0300, 127.0250, 127.0631, 127.0580, 127.0290, 127.0600, 127.0260,
    127.0650, 127.0610, 127.0550, 127.0640, 127.0280, 127.0620, 127.0240
  ] as lng_pool) as lngp,
  (SELECT ARRAY[
    '1501785888041-af3ef285b470', '1504674900247-0877df9cc836', '1506744038136-46273834b3fb', '1470071459604-3b5ec3a7fe05',
    '1474511320723-9a5617389965', '1441974231531-c6227db76b6e', '1516035069371-29a1b244cc32', '1469474968028-56623f02e42e',
    '1501785888041-af3ef285b470', '1504674900247-0877df9cc836', '1506744038136-46273834b3fb', '1470071459604-3b5ec3a7fe05',
    '1474511320723-9a5617389965', '1441974231531-c6227db76b6e', '1516035069371-29a1b244cc32'
  ] as img_pool) as ip,
  (SELECT ARRAY['food', 'place', 'animal', 'accident', 'place'] as category_pool) as catp;

-- 생성 후 즉시 반영을 위한 분석
ANALYZE public.posts;
