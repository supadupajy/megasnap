
INSERT INTO ads (id, label, ad_type, brand_name, brand_logo_url, title, subtitle, link_url, image_url, is_active, lat, lng, updated_at)
VALUES
  -- 강남구 (삼성역 근처)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '스타벅스', 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png',
   '오늘의 음료 20% 할인', '앱으로 주문하면 더 빠르게',
   'https://www.starbucks.co.kr', 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg',
   true, 37.5088, 127.0630, now()),

  -- 홍대 (합정역 근처)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '배달의민족', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
   '첫 주문 3,000원 할인', '지금 바로 주문하세요',
   'https://www.baemin.com', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
   true, 37.5497, 126.9136, now()),

  -- 이태원 (용산구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '나이키', 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
   '신상 에어맥스 출시', '지금 바로 만나보세요',
   'https://www.nike.com/kr', 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
   true, 37.5344, 126.9947, now()),

  -- 명동 (중구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '올리브영', 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg',
   '봄 신상 스킨케어 특가', '오늘만 최대 50% 할인',
   'https://www.oliveyoung.co.kr', 'https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg',
   true, 37.5636, 126.9869, now()),

  -- 여의도 (영등포구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   'ING생명', 'https://images.pexels.com/photos/3184183/pexels-photo-3184183.jpeg',
   '스마트 보험 가입 이벤트', '지금 가입하면 첫달 무료',
   'https://www.oranjelife.co.kr', 'https://images.pexels.com/photos/3184183/pexels-photo-3184183.jpeg',
   true, 37.5219, 126.9245, now()),

  -- 건대입구 (광진구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '맥도날드', 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg',
   '빅맥 세트 단돈 6,900원', '오늘 하루만 특별 가격',
   'https://www.mcdonalds.co.kr', 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg',
   true, 37.5403, 127.0699, now()),

  -- 신촌 (서대문구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   'CGV', 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg',
   '주말 영화 2인 15,000원', '지금 예매하고 팝콘 무료',
   'https://www.cgv.co.kr', 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg',
   true, 37.5551, 126.9368, now()),

  -- 잠실 (송파구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '롯데월드', 'https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg',
   '봄 시즌 입장권 특가', '어른 아이 모두 즐거운 하루',
   'https://adventure.lotteworld.com', 'https://images.pexels.com/photos/1166209/pexels-photo-1166209.jpeg',
   true, 37.5111, 127.0980, now()),

  -- 종로 (종로구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '교보문고', 'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg',
   '베스트셀러 20% 할인', '오늘의 추천 도서를 만나보세요',
   'https://www.kyobobook.co.kr', 'https://images.pexels.com/photos/1370295/pexels-photo-1370295.jpeg',
   true, 37.5700, 126.9784, now()),

  -- 강북 (노원구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '다이소', 'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg',
   '생활용품 균일가 1,000원', '없는 게 없는 다이소',
   'https://www.daiso-industries.com', 'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg',
   true, 37.6543, 127.0568, now());
