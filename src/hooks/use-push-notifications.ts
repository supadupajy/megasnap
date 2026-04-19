"use client";

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web' || !user) return;

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') return;

        await PushNotifications.register();

        // 토큰 등록
        PushNotifications.addListener('registration', async (token) => {
          await supabase
            .from('profiles')
            .update({ push_token: token.value })
            .eq('id', user.id);
        });

        // 알림 클릭 시 동작
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data;
          // 알림 데이터에 chatId가 있으면 해당 방으로 이동
          if (data && data.chatId) {
            navigate(`/chat/${data.chatId}`);
          } else {
            navigate('/notifications');
          }
        });

      } catch (err) {
        console.error('Push setup error:', err);
      }
    };

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, navigate]);
};