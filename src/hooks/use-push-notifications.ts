"use client";

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export const usePushNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    // 웹 브라우저가 아닌 실제 앱 환경에서만 동작
    if (Capacitor.getPlatform() === 'web' || !user) return;

    const registerPush = async () => {
      try {
        // 1. 권한 확인 및 요청
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission denied');
          return;
        }

        // 2. 푸시 서비스 등록
        await PushNotifications.register();

        // 3. 등록 성공 시 토큰 수신
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          
          // 4. Supabase profiles 테이블에 토큰 저장
          const { error } = await supabase
            .from('profiles')
            .update({ push_token: token.value })
            .eq('id', user.id);

          if (error) console.error('Error saving push token:', error);
        });

        // 등록 실패 시
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // 앱이 열려있을 때 알림 수신 시
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received:', notification);
        });

        // 사용자가 알림을 클릭했을 때
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed:', notification);
        });

      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    };

    registerPush();

    // 클린업: 리스너 제거
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);
};