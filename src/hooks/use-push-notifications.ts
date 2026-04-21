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
        // 기존 채널과 충돌을 피하기 위해 ID를 'messages_v2'로 변경 (채널 설정 변경은 새 ID 필요)
        await PushNotifications.createChannel({
          id: 'messages_v2',
          name: 'Chat Messages',
          description: '채팅 메시지 알림',
          sound: 'message_chime', // res/raw/message_chime.mp3
          importance: 5,
          visibility: 1,
          vibration: true,
        });
        console.log('[Push] Notification channel created: messages_v2');

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
        // DB에 토큰 저장
        await supabase
          .from('profiles')
          .update({ push_token: token.value })
          .eq('id', authUser.id);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
        
        // 중요: 포그라운드 수신 시 Capacitor의 기본 동작은 알림을 띄우지 않을 수 있습니다.
        // 하지만 OS 수준에서 소리를 재생하게 하려면, 알림 수신 시 사용자에게 시각적으로 표시하는 것이 좋습니다.
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