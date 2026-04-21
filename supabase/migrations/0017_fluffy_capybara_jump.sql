-- 트리거가 실제로 실행되는지 확인하기 위한 테스트 테이블 및 로직 추가
CREATE TABLE IF NOT EXISTS public.push_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID,
  status TEXT,
  error_msg TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6YWJpa2l1YXV4ZGJ2bmN1ZHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM4MzI3MiwiZXhwIjoyMDkxOTU5MjcyfQ.5GF_VSdyv6CWZpittcPuAD04j3UpTSPflyB3MLllhss';
  function_url TEXT := 'https://xzabikiuauxdbvncudsm.supabase.co/functions/v1/push-notification';
BEGIN
  -- 로깅 시작
  INSERT INTO public.push_logs (record_id, status) VALUES (NEW.id, 'START');

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
    
    UPDATE public.push_logs SET status = 'SUCCESS' WHERE record_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.push_logs SET status = 'ERROR', error_msg = SQLERRM WHERE record_id = NEW.id;
  END;
  
  RETURN NEW;
END;
$$;
