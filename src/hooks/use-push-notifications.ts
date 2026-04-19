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
        // 1. 리스너 등록
        await PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          // 토큰이 변경되었을 때만 업데이트하거나, 매번 업데이트하여 최신 상태 유지
          await supabase
            .from('profiles')
            .update({ push_token: token.value })
            .eq('id', user.id);
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error.error);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data;
          if (data && data.chatId) {
            navigate(`/chat/${data.chatId}`);
          } else {
            navigate('/notifications');
          }
        });

        // 2. 권한 확인 및 요청
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          // 3. 알림 등록 호출
          await PushNotifications.register();
        }

      } catch (err) {
        console.error('Push setup error:', err);
      }
    };

    registerPush();
    
    // 클린업: 리스너 제거
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, navigate]);
};