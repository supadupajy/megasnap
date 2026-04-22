UPDATE public.posts 
SET content = '[AD] ' || COALESCE(content, '추천 광고 콘텐츠입니다.')
WHERE id IN (
  SELECT id FROM public.posts 
  WHERE content NOT ILIKE '[AD]%' 
  ORDER BY random() 
  LIMIT (SELECT CEIL(COUNT(*) * 0.05) FROM public.posts)
);