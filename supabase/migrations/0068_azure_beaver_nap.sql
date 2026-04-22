SELECT p.id, p.content, p.user_id, pr.nickname 
FROM public.posts p
JOIN public.profiles pr ON p.user_id::text = pr.id::text
WHERE pr.nickname IN ('엄마쟤흙먹어', '비트코인떡락')
LIMIT 5;