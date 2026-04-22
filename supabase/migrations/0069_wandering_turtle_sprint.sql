INSERT INTO public.posts (
  user_id, 
  content, 
  location_name, 
  latitude, 
  longitude, 
  image_url, 
  category, 
  likes, 
  created_at
) VALUES 
(
  '11587de5-50a6-4f7f-8e2f-dbb8cbbf3528', 
  '[AD] 시원한 여름 신메뉴 출시! 지금 매장에서 만나보세요.', 
  '강남역 인근 맛집', 
  37.4979, 
  127.0276, 
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', 
  'food', 
  1200, 
  NOW()
),
(
  '0590527d-b61f-42d1-a83c-7bd23d39becf', 
  '[AD] 역대급 할인 이벤트! 한정 수량이니 서두르세요.', 
  '삼성동 쇼핑몰', 
  37.5113, 
  127.0596, 
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80', 
  'place', 
  850, 
  NOW()
);