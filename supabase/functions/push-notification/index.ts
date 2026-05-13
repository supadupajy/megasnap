import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Firebase 서비스 계정 정보를 Supabase Secret에서 읽어옵니다.
 * Secret 이름: FIREBASE_SERVICE_ACCOUNT
 * Secret 값 형식 (JSON 문자열):
 * {
 *   "project_id": "...",
 *   "client_email": "...",
 *   "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 * }
 */
function getFirebaseServiceAccount() {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) {
    throw new Error('[push-notification] FIREBASE_SERVICE_ACCOUNT secret is not set.');
  }
  try {
    return JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
  } catch {
    throw new Error('[push-notification] FIREBASE_SERVICE_ACCOUNT secret is not valid JSON.');
  }
}

/**
 * Google OAuth2 Access Token 획득 (FCM v1 필수)
 * Web Crypto API를 활용한 JWT 서명 로직
 */
async function getAccessToken(serviceAccount: { project_id: string; client_email: string; private_key: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging"
  };

  const sHeader = btoa(JSON.stringify(header)).replace(/=/g, "");
  const sPayload = btoa(JSON.stringify(payload)).replace(/=/g, "");
  const unsignedToken = `${sHeader}.${sPayload}`;

  // Private Key 파싱
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key.substring(
    serviceAccount.private_key.indexOf(pemHeader) + pemHeader.length,
    serviceAccount.private_key.indexOf(pemFooter)
  ).replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const sSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const signedJwt = `${unsignedToken}.${sSignature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    })
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Auth Failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Secret에서 Firebase 서비스 계정 로드
    const FB_SERVICE_ACCOUNT = getFirebaseServiceAccount();

    const payload = await req.json()
    // 트리거(record) 또는 직접 호출({chatId, ...}) 모두 대응
    const record = payload.record || payload;
    console.log(`[push-notification] Processing payload:`, JSON.stringify(record))

    const senderId = record.sender_id || record.senderId;
    const receiverId = record.receiver_id || record.receiverId;
    const content = record.content;

    if (!receiverId || !content) {
      return new Response("Missing required fields", { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 수신자 토큰/포그라운드 상태 (profiles_private)
    const { data: receiverPrivate, error: privateError } = await supabaseAdmin
      .from('profiles_private')
      .select('push_token, is_foreground')
      .eq('id', receiverId)
      .single();

    if (privateError || !receiverPrivate?.push_token) {
      console.log("[push-notification] No push token for receiver:", receiverId);
      return new Response("No token", { status: 200, headers: corsHeaders })
    }

    // 앱이 포그라운드 상태이면 시스템 푸시 알림 전송 안 함
    // (앱 내 Realtime 채널이 이미 알림음과 뱃지를 처리하므로 중복 불필요)
    if (receiverPrivate.is_foreground === true) {
      console.log("[push-notification] Receiver is in foreground, skipping push notification.");
      return new Response("Skipped (foreground)", { status: 200, headers: corsHeaders });
    }

    // 2. 발신자 닉네임 가져오기
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('nickname')
      .eq('id', senderId)
      .single();
    
    const senderNickname = senderProfile?.nickname || "누군가";
    const title = `${senderNickname}님의 메시지`;
    const body = content;

    // 3. OAuth2 토큰 생성 (FCM v1용)
    const accessToken = await getAccessToken(FB_SERVICE_ACCOUNT);

    // 4. FCM v1 전송 페이로드
    const fcmV1Payload = {
      message: {
        token: receiverPrivate.push_token,
        notification: {
          title: title,
          body: body
        },
        android: {
          priority: "high",
          notification: {
            channel_id: "messages_v3",
            sound: "default"
          }
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1
            }
          }
        },
        data: {
          chatId: String(senderId),
          type: "message"
        }
      }
    };

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FB_SERVICE_ACCOUNT.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fcmV1Payload)
    });

    const result = await res.json();
    console.log("[push-notification] FCM v1 Result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("[push-notification] Error:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
})
