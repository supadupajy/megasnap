-- messages 테이블에 메시지가 쌓일 때 notifications 테이블에도 알림이 쌓이도록 트리거 함수 수정/추가
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  -- 메시지 수신자에게 알림 생성
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (
    NEW.receiver_id, 
    NEW.sender_id, 
    'message', 
    CASE 
      WHEN length(NEW.content) > 30 THEN left(NEW.content, 30) || '...'
      ELSE NEW.content 
    END
  );
  RETURN NEW;
END;
$$;

-- 트리거 설정 (기존에 handle_new_message_push가 있더라도 추가로 작동하거나 통합 가능)
DROP TRIGGER IF EXISTS on_message_inserted_notification ON public.messages;
CREATE TRIGGER on_message_inserted_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_notification();
