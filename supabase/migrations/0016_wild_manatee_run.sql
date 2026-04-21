-- 1. 트리거 함수 로직 전면 검토 및 수정
-- net.http_post가 실패해도 메시지 생성에 영향을 주지 않도록 더욱 견고하게 작성
-- Service Role Key를 변수로 분리하여 가독성 및 관리성 향상
CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YWJpa2l1YXV4ZGJ2bmN1ZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4MzI3MiwiZXhwIjoyMDkxOTU5MjcyfQ.5GF_VSdyv6CWZpittcPuAD04j3UpTSPflyB3MLllhss';
  function_url TEXT := 'https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification';
BEGIN
  -- 비동기적인 느낌으로 Edge Function 호출 (타임아웃 5초)
  -- HTTP 200 이외의 응답이 와도 메시지 INSERT는 성공해야 하므로 예외 처리 필수
  BEGIN
    PERFORM
      net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object('record', row_to_json(NEW)),
        timeout_milliseconds := 5000
      );
  EXCEPTION WHEN OTHERS THEN
    -- 로그만 남기고 무시 (중요: 에러를 던지지 않음)
    RAISE LOG 'PUSH_ERROR: ID %, ERROR: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- 2. 트리거 재생성
DROP TRIGGER IF EXISTS on_message_inserted_push ON public.messages;
CREATE TRIGGER on_message_inserted_push
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_push();

-- 3. notifications 테이블에도 동일한 푸시 트리거 적용 (좋아요, 팔로우 알림용)
DROP TRIGGER IF EXISTS on_notification_inserted_push ON public.notifications;
CREATE TRIGGER on_notification_inserted_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_push();
