UPDATE public.posts 
SET image_url = CASE (id::text COLLATE "C" < '5')
  WHEN true THEN 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=90&sig=' || id
  ELSE 'https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&w=1200&q=90&sig=' || id
END
WHERE content ILIKE '[AD]%';