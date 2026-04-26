import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { isMobilePlatform } from '@/lib/utils';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

// 미리 오디오 객체를 생성해둠 (일부 브라우저에서 유리)
const foregroundAudio = new Audio(NOTIFICATION_SOUND_URL);

export const usePushNotifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (!authUser || !isMobilePlatform()) return; // 웹 환경에서는 실행하지 않음

    const register = async () => {
      try {
        // 1. 알림 채널 생성/업데이트 (Android 8.0+)
        // messages_v5로 업데이트하여 시스템 설정 강제 갱신
        await PushNotifications.createChannel({
          id: 'messages_v5',
          name: 'Important Chat Messages',
          description: '새 메시지 도착 알림음',
          sound: 'default', 
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          vibration: true,
        });
        console.log('[Push] Notification channel updated to v5');

        // Capacitor PushNotifications는 네이티브 앱 환경에서만 작동함
        // 웹 브라우저 환경이라면 여기서 중단됨
        if (!isMobilePlatform()) {
          console.log('[Push] Native Push is not supported on this platform (Web).');
          return;
        }

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
        
        try {
          // 현재 저장된 토큰 가져오기
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', authUser.id)
            .single();

          if (fetchError) {
            console.error('[Push] Failed to fetch current token:', fetchError);
          }

          // 토큰이 이미 동일하면 업데이트 스킵
          if (profile?.push_token === token.value) {
            console.log('[Push] Token is already up to date. Skipping DB update.');
            return;
          }

          // 토큰 갱신 로그 (추적용)
          console.log('[Push] Updating token in DB for user:', authUser.id);
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ push_token: token.value })
            .eq('id', authUser.id);

          if (updateError) console.error('[Push] Token update failed:', updateError);
          else console.log('[Push] Token successfully saved to DB');
        } catch (err) {
          console.error('[Push] Unexpected error during token update:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
        
        // 포그라운드 수신 시 직접 사운드 재생
        try {
          foregroundAudio.currentTime = 0;
          foregroundAudio.volume = 0.8;
          const playPromise = foregroundAudio.play();
          
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              console.warn('[Push] Foreground audio play blocked. Interaction might be needed.', e.message);
            });
          }
        } catch (e) {
          console.error('[Push] Audio error:', e);
        }

        // 포그라운드 수신 시 상단 팝업
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