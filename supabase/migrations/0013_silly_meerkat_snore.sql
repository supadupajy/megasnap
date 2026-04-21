-- 메시지 전송 시 알림(notifications) 테이블에 레코드를 생성하던 트리거 삭제
DROP TRIGGER IF EXISTS on_message_inserted_notification ON public.messages;
DROP FUNCTION IF EXISTS public.handle_new_message_notification();
