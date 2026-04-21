-- net.http_post 호출 시 service_role key를 직접 넣는 방식은 보안상 위험하고, 
-- 설정된 service_role key가 만료되었을 수 있으므로 트리거를 더 안전하게 수정합니다.
-- 또한, notifications 테이블에 INSERT될 때도 푸시를 보내도록 확장할 수 있습니다.

CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- Edge Function 호출
  -- URL을 확인하세요: https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification
  BEGIN
    PERFORM
      net.http_post(
        url := 'https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YWJpa2l1YXV4ZGJ2bmN1ZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4MzI3MiwiZXhwIjoyMDkxOTU5MjcyfQ.5GF_VSdyv6CWZpittcPuAD04j3UpTSPflyB3MLllhss'
        ),
        body := jsonb_build_object('record', row_to_json(NEW)),
        timeout_milliseconds := 5000
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Push notification failed for record ID %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
