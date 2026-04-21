import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 서비스 계정 정보를 활용한 v1 마이그레이션 (임시 수동 토큰 방식 시도)
// 2024년 7월 이후 Legacy API는 404/401 에러를 뱉으며 작동하지 않는 경우가 많습니다.
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

    const senderId = record.sender_id || record.actor_id;
    const { data: senderProfile } = await supabaseClient.from('profiles').select('nickname').eq('id', senderId).single();
    const senderNickname = senderProfile?.nickname || "누군가";

    let title = "ChoraSnap 알림";
    let body = "새로운 활동이 있습니다.";

    if (record.receiver_id) {
      title = `${senderNickname}님의 메시지`;
      body = record.content;
    } else if (record.type === 'like_post') {
      title = "좋아요 알림";
      body = `${senderNickname}님이 회원님의 포스팅을 좋아합니다.`;
    }

    // --- 최후의 수단: Legacy API를 다시 시도하되 페이로드를 극도로 단순화 ---
    // 만약 이것도 안된다면 구글이 해당 엔드포인트를 완전히 폐쇄한 것입니다.
    const fcmPayload = {
      to: profile.push_token,
      priority: "high",
      notification: {
        title: title,
        body: body,
        sound: "default"
      }
    };

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
    console.log("[push] Final Attempt Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("[push] Error:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
})
