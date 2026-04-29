
INSERT INTO ads (id, label, ad_type, is_active, image_url, title, subtitle, link_url, brand_name, brand_logo_url)
VALUES (
  'post_slide',
  '포스팅 슬라이드 광고',
  'post_slide',
  true,
  'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
  '코카콜라와 함께하는 특별한 순간',
  '지금 바로 경험해보세요',
  'https://www.coca-cola.co.kr/',
  'Coca-Cola',
  ''
)
ON CONFLICT (id) DO NOTHING;
