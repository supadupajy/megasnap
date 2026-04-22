import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// [FCM v1] 서비스 계정 정보 - 제공해주신 정보를 기반으로 구성
const FB_SERVICE_ACCOUNT = {
  "project_id": "gen-lang-client-0536770943",
  "client_email": "firebase-adminsdk-fbsvc@gen-lang-client-0536770943.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCccimy/uiZWoey\n+iQR2ClnaCGl7ixBzFRt7eq16gFahzNLEL297Sw8UCnbt2Ub1wgRIHGs/m/qFJ5r\nmxl7foqed4R7AVg9R9WV05j7lMbMmM8gfMHJ+HxwZrnZnbar/uQqB82lPvbo54nm\npCvkqUNqAWP/PEt/huiRQf8zz/MLWElo+QadsCksCVlq7Xr5SzSHNX5411nuGVc/\negNsctfrOpOZxsk+pQaxNQ+opM22QbxlkPG3rpOjm3bFzOn8B0GCJoYVNKmTNw74\nabVk5gBFNLBaQ2AV5ahf8KX+MHKSRGwsVtKc/6utCXMdDERGcAjOTlJ0Rssvt07Q\notj3VBqPAgMBAAECggEAF/xO1VvMozpkhLW3famOYNrFEeYWu03NrKml6xcXTF8J\n0lqc5KIYvp8saRHQkCNN4CZWbLH5IZfgrq8cXzky8oHGJNUQx3Bx2CNAGLj3fnB3\n4nYOK142t0Wgp93MycjuCAhN6KW4gFPYv4JFx9cwTUUs+iRZ5Ob1ACmbVsEX9RHq\nPe15Qps0Dba9JHdJYPWbujILBs3cuSYsJrWN+fe2J3CqOzdioe493Qvrf+N/1sge\nScGgMkOEE7Y2gMm+3FeNdPQEMsv+Ltns9NskLKbe6zCdhk8KzU4kmlmtnWUuAZXZ\ngS8LNR5BrsqCm/ClpEJWCXSWGpuWjsi0ZjeW1QF7qQKBgQDNWDLy6I6mGsEZI6nW\nCzaQviU7oT5Vd1uAm7yMW5uvWPDvZ+zjuMu0dyjQBi0I7NkhB2AWVLiFVot/LGhG\nZ6UW7Odk8hkDKhnsvhXwzJbOx8uE+K39CPo7SkA6NH2y9N7i6jttqqnQQpDLCita\nAKEXRuUT0OFELV6XEgcxDebOpwKBgQDDCfLXbbIGK+zGiM773it8EwHEUlmVri4t\nNXT/DxlSdCBMexXHPQBsMcGIZG7Q2hs7d5ptQ7CZGZ5vdxw2rxHcMwq1ZRdr0sgV\niFWitLDaewPXerl5Tztr2WV/zr1Zk6AMc+gy5AWWzVWTYNbhAEQx3L85LlYwh/oW\nWeFrAy552QKBgBrRTP4aTx70WYmd9b1Fg5/NpXEvMsPYrbOTI0G1aRSyaezqRq7K\n4Je2BDd+xvzmacj9fJgOAncvgVJfi1K+kHn5AJNXZtrZ8b7QaG8lWQCyaSr5i0eD\nl6KMpOy1FEF952n9Kzu8UScoul45+sVrVZ6DnMFEw1azEipqqVPHu//7AoGAHZQd\nqwQs0njI4NcQpOvtplRvmSlwAp42zI5l3uSYT4Pi/hZQmDWtIbtuAVRR5gSdyqf5\n2IZCewWCnJ7wvW5RhBaNkjLxmV2PEIzrh9BlXcz4KS6ogDg+571Bgl+FIdeclybg\n2Q7xtgwP5VjzXY4fyXwT2AUp9xQ4HjmlUQhbfQkCgYATRrBb8JUkyJ1SaKF3lo/q\nToSLpCM25qNb23/APGSF+vtAo2C34QeJlU3F7ujdZo7P7oTAsmyYVBg8izI9Fl3+\nnZcU8FB8mKikuIoJTVOv2l9WIzUkwcvKhb2pequl9cFuza68+ZrcT04hepWe2b/H\nNCJoFGy9i3NhOASWo4CTwg==\n-----END PRIVATE KEY-----\n"
};

/**
 * Google OAuth2 Access Token 획득 (FCM v1 필수)
 * 에지 펑션 라이브러리 제약으로 인해 가장 순수한 Deno 방식으로 구현 시도
 */
async function getAccessToken(): Promise<string> {
  // Web Crypto API를 활용한 JWT 서명 로직
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: FB_SERVICE_ACCOUNT.client_email,
    sub: FB_SERVICE_ACCOUNT.client_email,
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
  const pemContents = FB_SERVICE_ACCOUNT.private_key.substring(
    FB_SERVICE_ACCOUNT.private_key.indexOf(pemHeader) + pemHeader.length,
    FB_SERVICE_ACCOUNT.private_key.indexOf(pemFooter)
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

  // 엑세스 토큰 요청
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
    const { record, table, type, schema } = await req.json()
    console.log(`[push-notification] Processing ${type} on ${schema}.${table}`)

    if (table === 'messages' && type === 'INSERT') {
      const { sender_id, receiver_id, content } = record

      // 수신자의 활성 세션(Presence) 확인하여 채팅 중인지 체크
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // 1. 수신자가 현재 발신자와의 채팅창을 열고 있는지 확인 (Presence 등 활용 가능하나 여기선 간단히 채널 참여 여부 가정)
      // 실제로는 클라이언트에서 'is_in_chat' 상태를 DB나 Redis에 저장하거나, 
      // FCM의 data-only 메시지를 보내서 클라이언트가 직접 결정하게 하는 것이 정확함.
      // 하지만 여기서는 기본적으로 뱃지를 포함하되, 클라이언트 사이드에서 처리하도록 유도하거나
      // 특정 조건(예: 최근 3초 내 읽음 처리됨) 등을 고려할 수 있음.
      
      // 여기서는 수신자에게 알림을 보냅니다.
      const { data: receiverProfile } = await supabaseAdmin
        .from('profiles')
        .select('push_token, nickname')
        .eq('id', receiver_id)
        .single()

      if (!receiverProfile?.push_token) return new Response("No token", { status: 200 })

      const senderId = record.sender_id || record.actor_id;
      const { data: senderProfile } = await supabaseClient.from('profiles').select('nickname').eq('id', senderId).single();
      const senderNickname = senderProfile?.nickname || "누군가";

      let title = "ChoraSnap";
      let body = "알림이 도착했습니다.";

      if (record.receiver_id) {
        title = `${senderNickname}님의 메시지`;
        body = record.content;
      } else if (record.type === 'like_post') {
        title = "좋아요";
        body = `${senderNickname}님이 포스팅을 좋아합니다.`;
      }

      // 1. OAuth2 토큰 생성
      const accessToken = await getAccessToken();

      // 2. FCM v1 전송 페이로드 구성
      const fcmV1Payload = {
        message: {
          token: profile.push_token,
          notification: {
            title: title,
            body: body
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "messages_v3",
              sound: "message_pop"
            }
          },
          apns: {
            payload: {
              aps: {
                sound: "message_pop.caf",
                badge: 1
              }
            }
          },
          data: {
            chatId: record.sender_id || "",
            type: record.receiver_id ? "message" : "notif"
          }
        }
      };

      // 3. FCM v1 엔드포인트 호출
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FB_SERVICE_ACCOUNT.project_id}/messages:send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmV1Payload)
      });

      const result = await res.json();
      console.log("[FCM v1] Result:", JSON.stringify(result));

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      return new Response("Unsupported operation", { status: 400 });
    }
  } catch (err) {
    console.error("[FCM v1] Error:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
})