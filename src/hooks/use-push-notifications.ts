import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { isMobilePlatform } from '@/lib/utils';

export const usePushNotifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (!authUser || !isMobilePlatform()) return; // 웹 환경에서는 실행하지 않음

    const register = async () => {
      try {
        // 1. 커스텀 사운드를 위한 알림 채널 생성 (Android 8.0+)
        // 캐시를 무효화하고 설정을 강제 적용하기 위해 ID를 'messages_v4'로 업그레이드
        await PushNotifications.createChannel({
          id: 'messages_v4', // ID 변경으로 설정 갱신 유도
          name: 'Chat Messages',
          description: '채팅 메시지 알림',
          sound: 'default', // 커스텀 파일이 없을 경우를 대비해 기본음으로 설정하거나 'message_pop' 유지
          importance: 5, // 최고 중요도 (헤드업 알림 + 소리)
          visibility: 1,
          vibration: true,
        });
        console.log('[Push] Notification channel created/updated: messages_v4');

        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          // console.warn('Push notification permission denied.');
          return;
        }

        await PushNotifications.register();
      } catch (error) {
        console.error('Error registering push notifications:', error);
      }
    };

    const addListeners = () => {
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        // 토큰 갱신 로그 (추적용)
        console.log('[Push] Updating token in DB for user:', authUser.id);
        
        const { error } = await supabase
          .from('profiles')
          .update({ push_token: token.value })
          .eq('id', authUser.id);

        if (error) console.error('[Push] Token update failed:', error);
        else console.log('[Push] Token successfully saved to DB');
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
        // 포그라운드 수신 시 상단 팝업을 수동으로 띄우거나 앱 내 UI 업데이트
        showSuccess(`${notification.title || '새 알림'}: ${notification.body}`);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        const data = notification.notification.data;
        
        if (data?.type === 'message' && data.chatId) {
          navigate(`/chat/${data.chatId}`);
        } else if (data?.type !== 'message' && data?.postId) {
          navigate('/', { state: { postId: data.postId } });
        } else {
          navigate('/notifications');
        }
      });
    };

    register();
    addListeners();

    return () => {
      // 리스너 제거 로직 (필요 시)
    };
  }, [authUser, navigate]);
};