-- 프로필 정보를 조인하여 최신 정보를 포함하는 뷰 생성 (PostgREST 성능 및 안정성 향상용)
-- 만약 posts 테이블에 user_name/user_avatar를 중복 저장하는 방식이 에러를 유발한다면 뷰를 쓰는 것이 좋습니다.
-- 하지만 현재는 500 에러 해결을 위해 posts 테이블 자체를 다시 한 번 정리합니다.

UPDATE public.posts p
SET 
  user_name = COALESCE(pr.nickname, p.user_name, '탐험가'),
  user_avatar = COALESCE(pr.avatar_url, p.user_avatar, 'https://i.pravatar.cc/150?u=' || p.user_id)
FROM public.profiles pr
WHERE p.user_id = pr.id::text;
