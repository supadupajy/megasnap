
CREATE OR REPLACE FUNCTION public.update_post_hot_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_post_id UUID;
  current_likes BIGINT;
BEGIN
  -- INSERT면 NEW, DELETE면 OLD에서 post_id 가져옴
  IF TG_OP = 'INSERT' THEN
    target_post_id := NEW.post_id;
  ELSE
    target_post_id := OLD.post_id;
  END IF;

  -- 현재 posts.likes 값 가져오기
  SELECT likes INTO current_likes
  FROM public.posts
  WHERE id = target_post_id;

  -- 좋아요가 100의 배수에 도달했는지 확인 (100, 200, 300, ...)
  -- INSERT일 때만 체크 (좋아요 추가 시에만 마일스톤 달성 가능)
  IF TG_OP = 'INSERT' AND current_likes > 0 AND current_likes % 100 = 0 THEN
    -- 100개 단위 달성: hot_since를 현재 시각으로 업데이트 (항상 갱신)
    UPDATE public.posts
    SET hot_since = NOW()
    WHERE id = target_post_id;
  ELSE
    -- hot_since가 설정되어 있고 1시간이 지났으면 해제
    UPDATE public.posts
    SET hot_since = NULL
    WHERE id = target_post_id
      AND hot_since IS NOT NULL
      AND hot_since < NOW() - INTERVAL '1 hour';
  END IF;

  RETURN NULL;
END;
$$;
