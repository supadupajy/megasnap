-- 기존 포스팅들의 데이터를 현재 프로필 정보와 동기화합니다.
UPDATE public.posts p
SET 
  user_name = pr.nickname,
  user_avatar = pr.avatar_url
FROM public.profiles pr
WHERE p.user_id = pr.id::text;
