-- 1. net.http_post 호출 시 service_role key 인증 및 URL 재검증
CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- 에지 펑션 호출 시도
  BEGIN
    PERFORM
      net.http_post(
        url := 'https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YWJpa2l1YXV4ZGJ2bmN1ZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4MzI3MiwiZXhwIjoyMDkxOTU5MjcyfQ.5GF_VSdyv6CWZpittcPuAD04j3UpTSPflyB3MLllhss'
        ),
        body := jsonb_build_object('record', row_to_json(NEW)),
        timeout_milliseconds := 7000
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Edge Function invocation failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 2. 트리거가 확실히 활성화되어 있는지 재확인
DROP TRIGGER IF EXISTS on_message_inserted_push ON public.messages;
CREATE TRIGGER on_message_inserted_push
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_push();
