UPDATE posts 
SET image_url = CASE 
  WHEN category = 'food' THEN 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'
  WHEN category = 'animal' THEN 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg'
  ELSE 'https://images.pexels.com/photos/2371233/pexels-photo-2371233.jpeg'
END
WHERE image_url LIKE '%unsplash.com%';
