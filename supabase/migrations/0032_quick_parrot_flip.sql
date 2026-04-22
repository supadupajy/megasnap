-- trigger 함수 수정 (캐스팅 명시 및 오류 방지)
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- nickname 또는 avatar_url이 변경된 경우에만 실행
  IF (NEW.nickname IS DISTINCT FROM OLD.nickname OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    -- user_id가 UUID 형태의 string임을 고려하여 명확하게 매칭
    UPDATE public.posts
    SET 
      user_name = NEW.nickname,
      user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;
