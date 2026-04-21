-- 기존의 handle_new_message_push 함수 수정 (SQL 툴 사용)
CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- Edge Function 호출 (오류가 발생해도 메시지 생성 프로세스는 중단되지 않도록 예외 처리)
  BEGIN
    PERFORM
      net.http_post(
        url := 'https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YWJpa2l1YXV4ZGJ2bmN1ZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4MzI3MiwiZXhwIjoyMDkxOTU5MjcyfQ.5GF_VSdyv6CWZpittcPuAD04j3UpTSPflyB3MLllhss'
        ),
        body := jsonb_build_object('record', row_to_json(NEW)),
        timeout_milliseconds := 2000
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Push notification failed for message ID %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
