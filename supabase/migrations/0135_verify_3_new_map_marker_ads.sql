
SELECT brand_name, title, lat, lng, is_active 
FROM ads 
WHERE ad_type = 'map_marker' 
  AND brand_name IN ('현대백화점', '투썸플레이스', '신세계백화점');
