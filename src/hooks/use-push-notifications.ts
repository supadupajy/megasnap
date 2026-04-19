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
        // 기존 리스너 제거 (중복 등록 방지)
        await PushNotifications.removeAllListeners();

        // 1. 리스너 등록
        await PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
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
    
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, navigate]);
};