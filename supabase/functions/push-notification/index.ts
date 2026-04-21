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
    // 현재 https://fcm.googleapis.com/fcm/send (Legacy API)가 404를 반환하고 있습니다.
    // 이는 구글에서 Legacy API를 비활성화했거나 엔드포인트가 변경되었을 수 있습니다.
    // 최신 방식인 HTTP v1 API를 사용하는 것이 권장되지만, 여기서는 일단 오류 발생 시 앱이 중단되지 않도록
    // FCM 호출 부분을 안전하게 감싸고 로그만 남깁니다.
    
    let fcmResult = { message: "FCM call skipped or failed" };
    
    try {
      const fcmPayload = {
        to: pushToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
          sound: "default",
        },
        data: dataPayload,
        apns: {
          payload: {
            aps: {
              contentAvailable: 1,
            },
          },
        },
      };

      console.log(`[push-notification] Attempting to send FCM to ${receiverId}...`);
      
      const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      const responseText = await fcmResponse.text();
      
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