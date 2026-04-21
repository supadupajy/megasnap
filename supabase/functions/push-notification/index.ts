// Minimal Deno interface to satisfy local TS compiler (Fixes TS2304)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore (Fixes TS2307)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore (Fixes TS2307)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FCM 서버 키 (환경 변수에서 가져와야 함)
// 실제 키는 Supabase Secrets에 저장되어 있어야 합니다.
// 여기서는 임시로 더미 키를 사용합니다. 실제 배포 시에는 Secrets를 사용해야 합니다.
const FCM_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY') || 'YOUR_FCM_SERVER_KEY_HERE';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const record = payload.record;
    
    if (!record) {
      console.log("[push-notification] No record found in payload.");
      return new Response(JSON.stringify({ message: "No record found" }), { status: 400, headers: corsHeaders });
    }

    let receiverId: string;
    let notificationBody: string;
    let notificationTitle: string;
    let dataPayload: Record<string, any> = {};

    // 1. 레코드 유형에 따라 수신자 ID 및 메시지 내용 결정
    if (record.type) { // notifications 테이블에서 온 경우 (like, follow, comment)
      receiverId = record.user_id;
      notificationTitle = "새로운 활동 알림";
      
      const { data: actorProfile } = await supabaseClient
        .from('profiles')
        .select('nickname')
        .eq('id', record.actor_id)
        .single();
      
      const actorName = actorProfile?.nickname || "누군가";

      switch (record.type) {
        case 'follow':
          notificationBody = `${actorName}님이 회원님을 팔로우하기 시작했습니다.`;
          break;
        case 'like_post':
          notificationBody = `${actorName}님이 회원님의 포스팅을 좋아합니다.`;
          break;
        case 'comment':
          notificationBody = `${actorName}님이 댓글을 남겼습니다: ${record.content.substring(0, 20)}...`;
          break;
        default:
          notificationBody = "새로운 알림이 도착했습니다.";
      }
      dataPayload = { type: record.type, postId: record.post_id };

    } else if (record.receiver_id) { // messages 테이블에서 온 경우 (DM)
      receiverId = record.receiver_id;
      
      const { data: senderProfile } = await supabaseClient
        .from('profiles')
        .select('nickname')
        .eq('id', record.sender_id)
        .single();
      
      const senderName = senderProfile?.nickname || "새로운 사용자";
      
      notificationTitle = `${senderName}님으로부터 메시지`;
      notificationBody = record.content.substring(0, 50);
      dataPayload = { type: 'message', chatId: record.sender_id };

    } else {
      console.log("[push-notification] Unknown record type.");
      return new Response(JSON.stringify({ message: "Unknown record type" }), { status: 400, headers: corsHeaders });
    }

    // 2. 수신자의 푸시 토큰 조회
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('push_token')
      .eq('id', receiverId)
      .single();

    const pushToken = profileData?.push_token;

    if (!pushToken) {
      console.log(`[push-notification] No push token found for user ${receiverId}.`);
      return new Response(JSON.stringify({ message: "No push token" }), { status: 200, headers: corsHeaders });
    }

    // 3. FCM 푸시 알림 발송
    let fcmResult = { message: "FCM call skipped or failed" };
    
    try {
      // Legacy API 엔드포인트
      const LEGACY_FCM_URL = 'https://fcm.googleapis.com/fcm/send';

      const fcmPayload = {
        to: pushToken,
        priority: "high",
        notification: {
          title: notificationTitle,
          body: notificationBody,
          sound: "message_chime", 
          icon: "fcm_push_icon", // 기본 아이콘 지정 시도
        },
        data: {
          ...dataPayload,
          title: notificationTitle,
          body: notificationBody,
        },
        android: {
          priority: "high",
          notification: {
            channel_id: "messages_v2", 
            sound: "message_chime", 
            default_sound: false,
            default_vibrate_timings: true,
            notification_priority: "PRIORITY_MAX", // 안드로이드 시스템 우선순위 최대
            visibility: "PUBLIC"
          }
        },
        apns: {
          headers: {
            "apns-priority": "10" // iOS 즉시 전송 우선순위
          },
          payload: {
            aps: {
              alert: {
                title: notificationTitle,
                body: notificationBody
              },
              sound: "message_chime.caf",
              badge: 1,
              "content-available": 1
            },
          },
        },
      };

      console.log(`[push-notification] SENDING_FCM to: ${receiverId}, channel: messages_v2`);
      
      const fcmResponse = await fetch(LEGACY_FCM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `key=${FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      const responseText = await fcmResponse.text();
      console.log(`[push-notification] FCM_RESPONSE: Status ${fcmResponse.status}, Body: ${responseText}`);

      if (!fcmResponse.ok) {
        console.warn(`[push-notification] FCM server returned error ${fcmResponse.status}:`, responseText.substring(0, 200));
        fcmResult = { error: `FCM server returned ${fcmResponse.status}`, detail: responseText.substring(0, 100) };
      } else {
        try {
          fcmResult = JSON.parse(responseText);
          console.log(`[push-notification] FCM sent successfully:`, fcmResult);
        } catch (e) {
          console.warn("[push-notification] FCM response was not JSON:", responseText.substring(0, 100));
          fcmResult = { message: "FCM sent but response was not JSON", text: responseText.substring(0, 50) };
        }
      }
    } catch (fcmError) {
      console.error("[push-notification] Critical FCM fetch error:", fcmError.message);
      fcmResult = { error: "Fetch failed", message: fcmError.message };
    }

    return new Response(JSON.stringify({ success: true, fcmResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("[push-notification] Error processing request:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});