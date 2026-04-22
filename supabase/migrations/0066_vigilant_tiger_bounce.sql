DELETE FROM public.posts 
WHERE user_id::text IN (
  SELECT id::text FROM public.profiles 
  WHERE nickname IN ('엄마쟤흙먹어', '비트코인떡락')
);