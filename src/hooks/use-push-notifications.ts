import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

export const usePushNotifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (!authUser) return;

    const register = async () => {
      try {
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
        // 포그라운드에서 푸시 수신 시, 헤더의 뱃지 카운트를 강제로 새로고침 (Header.tsx의 Realtime 구독이 처리함)
        // 여기서는 알림을 토스트로 표시하거나, 뱃지 카운트 업데이트를 트리거할 수 있습니다.
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