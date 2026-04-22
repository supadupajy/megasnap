UPDATE public.posts 
SET likes = floor(random() * 5000 + 10000)::int
WHERE id IN (
  SELECT id FROM public.posts 
  WHERE content NOT ILIKE '[AD]%' 
  ORDER BY random() 
  LIMIT (SELECT CEIL(COUNT(*) * 0.02) FROM public.posts)
);