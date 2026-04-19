"use client";

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showError } from '@/utils/toast';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 웹 환경이거나 유저가 없으면 실행하지 않음
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

        // 2. 알림 등록
        await PushNotifications.register();

        // 3. 토큰 수신 리스너
        const regListener = await PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          const { error } = await supabase
            .from('profiles')
            .update({ push_token: token.value })
            .eq('id', user.id);
          
          if (error) console.error('Error saving push token:', error);
        });

        // 4. 등록 실패 리스너
        const errListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error.error);
        });

        // 5. 알림 클릭 리스너
        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data;
          console.log('Push action performed:', data);
          if (data && data.chatId) {
            navigate(`/chat/${data.chatId}`);
          } else {
            navigate('/notifications');
          }
        });

        return () => {
          regListener.remove();
          errListener.remove();
          actionListener.remove();
        };

      } catch (err) {
        console.error('Push setup error:', err);
      }
    };

    registerPush();
  }, [user, navigate]);
};