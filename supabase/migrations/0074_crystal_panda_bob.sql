UPDATE public.posts 
SET 
  youtube_url = NULL, 
  video_url = NULL, 
  image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=90&sig=' || id
WHERE content ILIKE '[AD]%';