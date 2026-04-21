import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const record = payload.record;
    if (!record) return new Response("No record", { status: 400 });

    const receiverId = record.receiver_id || record.user_id;
    const { data: profile } = await supabaseClient.from('profiles').select('push_token, nickname').eq('id', receiverId).single();

    if (!profile?.push_token) {
      console.log("[push] No token for user:", receiverId);
      return new Response("No token", { status: 200 });
    }

    // 1. 발신자 정보 가져오기 (닉네임용)
    const senderId = record.sender_id || record.actor_id;
    const { data: senderProfile } = await supabaseClient.from('profiles').select('nickname').eq('id', senderId).single();
    const senderNickname = senderProfile?.nickname || "누군가";

    // 2. 알림 내용 구성
    let title = "ChoraSnap 알림";
    let body = "새로운 활동이 있습니다.";

    if (record.receiver_id) { // 메시지인 경우
      title = `${senderNickname}님의 메시지`;
      body = record.content;
    } else if (record.type === 'like_post') {
      title = "좋아요 알림";
      body = `${senderNickname}님이 회원님의 포스팅을 좋아합니다.`;
    } else if (record.type === 'comment') {
      title = "댓글 알림";
      body = `${senderNickname}님이 댓글을 남겼습니다.`;
    } else if (record.type === 'follow') {
      title = "팔로우 알림";
      body = `${senderNickname}님이 회원님을 팔로우하기 시작했습니다.`;
    }

    // 3. FCM 발송 (가장 호환성 높은 설정)
    const fcmPayload = {
      to: profile.push_token,
      priority: "high",
      notification: {
        title: title,
        body: body,
        sound: "message_chime",
        icon: "fcm_push_icon"
      },
      data: {
        type: record.receiver_id ? "message" : "notification",
        chatId: record.sender_id || "",
        postId: record.post_id || ""
      },
      android: {
        priority: "high",
        notification: {
          channel_id: "messages_v2",
          sound: "message_chime",
          default_vibrate_timings: true
        }
      }
    };

    // Firebase Server Key는 이미 Supabase Secrets에 등록된 값을 사용합니다.
    const SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY');
    
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    const result = await res.json();
    console.log("[push] FCM Final Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("[push] Error:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
})
