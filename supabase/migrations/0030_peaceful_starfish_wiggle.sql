-- 1. 함수 생성 (프로필 변경 시 포스트 정보 업데이트)
CREATE OR REPLACE FUNCTION public.handle_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- nickname 또는 avatar_url이 변경된 경우에만 실행
  IF (NEW.nickname IS DISTINCT FROM OLD.nickname OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    UPDATE public.posts
    SET 
      user_name = NEW.nickname,
      user_avatar = NEW.avatar_url
    WHERE user_id = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. 트리거 설정
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update();
