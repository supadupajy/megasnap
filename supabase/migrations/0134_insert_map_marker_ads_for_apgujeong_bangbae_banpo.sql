
INSERT INTO ads (id, label, ad_type, brand_name, brand_logo_url, title, subtitle, link_url, image_url, is_active, lat, lng, updated_at)
VALUES
  -- 압구정동 (강남구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '현대백화점', 'https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg',
   '압구정 봄 세일 최대 70%', '프리미엄 브랜드 특별 할인',
   'https://www.ehyundai.com', 'https://images.pexels.com/photos/1884581/pexels-photo-1884581.jpeg',
   true, 37.5272, 127.0286, now()),

  -- 방배동 (서초구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '투썸플레이스', 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg',
   '케이크 + 음료 세트 특가', '방배 카페거리에서 만나요',
   'https://www.twosome.co.kr', 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg',
   true, 37.4812, 126.9974, now()),

  -- 반포동 (서초구)
  (gen_random_uuid(), '지도 마커 광고', 'map_marker',
   '신세계백화점', 'https://images.pexels.com/photos/쇼핑/3965545/pexels-photo-3965545.jpeg',
   '반포 강변 쇼핑 페스타', '지금 방문하면 주차 무료',
   'https://www.shinsegae.com', 'https://images.pexels.com/photos/3965545/pexels-photo-3965545.jpeg',
   true, 37.5040, 127.0050, now());
