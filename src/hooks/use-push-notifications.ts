import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { App as CapApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess } from '@/utils/toast';
import { isMobilePlatform } from '@/lib/utils';

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 포그라운드 상태를 DB에 업데이트
const updateForegroundState = async (userId: string, isForeground: boolean) => {
  try {
    await supabase
      .from('profiles_private')
      .update({ is_foreground: isForeground })
      .eq('id', userId);
  } catch (e) {}
};

export const usePushNotifications = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  // 포그라운드/백그라운드 상태 추적 (웹 + 네이티브 공통)
  useEffect(() => {
    if (!authUser?.id) return;
    const userId = authUser.id;

    // 앱 시작 시 포그라운드로 설정
    updateForegroundState(userId, true);

    if (isMobilePlatform()) {
      // 네이티브: Capacitor App 상태 변화 감지
      const listenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
        updateForegroundState(userId, isActive);
      });
      return () => {
        updateForegroundState(userId, false);
        listenerPromise.then(l => l.remove());
      };
    } else {
      // 웹: visibilitychange 이벤트 감지
      const handleVisibility = () => {
        updateForegroundState(userId, document.visibilityState === 'visible');
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        updateForegroundState(userId, false);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser || !isMobilePlatform()) return;

    let cancelled = false;
    let registerInFlight = false;

    const requestStartupPermission = async (delays = [0, 1600, 3500, 6000]) => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive !== 'prompt') return permStatus;

      // 앱 시작 시 위치 권한 팝업이 먼저 떠 있으면 알림 권한 팝업이 무시/지연될 수 있어
      // 짧은 간격으로 재확인해 사용자가 위치 팝업을 닫은 직후 알림 팝업도 이어서 표시되도록 한다.
      for (const delay of delays) {
        if (cancelled) return permStatus;
        if (delay > 0) await wait(delay);

        permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'prompt') return permStatus;

        try {
          permStatus = await PushNotifications.requestPermissions();
          if (permStatus.receive !== 'prompt') return permStatus;
        } catch (error) {
          console.warn('[Push] Permission request was delayed or interrupted:', error);
        }
      }

      return permStatus;
    };

    const register = async (forceImmediate = false) => {
      if (registerInFlight && !forceImmediate) return;
      registerInFlight = true;

      try {
        await PushNotifications.createChannel({
          id: 'messages_v5',
          name: 'Important Chat Messages',
          description: '새 메시지 도착 알림음',
          sound: 'default',
          importance: 5,
          visibility: 1,
          vibration: true,
        });

        if (!isMobilePlatform()) return;

        const permStatus = await requestStartupPermission(forceImmediate ? [0] : undefined);

        if (permStatus.receive !== 'granted') return;

        await PushNotifications.register();
      } catch (error) {
        console.error('Error registering push notifications:', error);
      } finally {
        registerInFlight = false;
      }
    };

    const addListeners = () => {
      PushNotifications.addListener('registration', async (token) => {
        try {
          const { data: profile, error: fetchError } = await supabase
            .from('profiles_private')
            .select('push_token')
            .eq('id', authUser.id)
            .single();

          if (fetchError) {
            console.error('[Push] Failed to fetch current token:', fetchError);
          }

          if (profile?.push_token === token.value) {
            return;
          }

          const { error: updateError } = await supabase
            .from('profiles_private')
            .update({ push_token: token.value })
            .eq('id', authUser.id);

          if (updateError) console.error('[Push] Token update failed:', updateError);
        } catch (err) {
          console.error('[Push] Unexpected error during token update:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', () => {
        // 포그라운드에서는 NotificationProvider의 Realtime 채널이 이미 소리를 재생하므로
        // 여기서 중복 재생하지 않음 (알림음 2번 울리는 버그 방지)
        // 시스템 알림 배너도 Edge Function에서 포그라운드 체크 후 전송 안 하므로 여기선 아무것도 안 함
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        const data = notification.notification.data;

        if (data?.type === 'message' && data.chatId) {
          navigate(`/chat/${data.chatId}`);
        } else if (data?.type !== 'message' && data?.postId) {
          navigate('/', { state: { postId: data.postId, openPostDetail: true } });
        } else {
          navigate('/notifications');
        }
      });
    };

    const handleRequestPermissionNow = () => {
      register(true);
    };

    window.addEventListener('request-push-permission-now', handleRequestPermissionNow);
    register();
    addListeners();

    return () => {
      cancelled = true;
      window.removeEventListener('request-push-permission-now', handleRequestPermissionNow);
      // 등록된 Capacitor PushNotifications 리스너 정리 (재마운트 시 누적 방지)
      PushNotifications.removeAllListeners().catch(() => {});
    };
  }, [authUser, navigate]);
};