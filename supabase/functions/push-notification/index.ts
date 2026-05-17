import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...init?.headers },
  })
}

/**
 * Firebase 서비스 계정 정보를 Supabase Secret에서 읽어옵니다.
 * Secret 이름: FIREBASE_SERVICE_ACCOUNT
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
    throw new Error('[push-notification] Firebase auth failed');
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const payload = await req.json().catch(() => null)
    const record = payload?.record

    if (!record?.id || typeof record.id !== 'string') {
      console.warn('[push-notification] Rejected request without database message id')
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, receiver_id, content')
      .eq('id', record.id)
      .single()

    if (messageError || !message) {
      console.warn('[push-notification] Rejected request for unknown message id', { messageId: record.id })
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    if (
      (record.sender_id && record.sender_id !== message.sender_id) ||
      (record.receiver_id && record.receiver_id !== message.receiver_id) ||
      (record.content && record.content !== message.content)
    ) {
      console.warn('[push-notification] Rejected request with mismatched message payload', { messageId: message.id })
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[push-notification] Processing verified message', { messageId: message.id })

    const receiverId = message.receiver_id
    const senderId = message.sender_id
    const content = message.content

    if (!receiverId || !content) {
      return jsonResponse({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: receiverPrivate, error: privateError } = await supabaseAdmin
      .from('profiles_private')
      .select('push_token, is_foreground')
      .eq('id', receiverId)
      .single();

    if (privateError || !receiverPrivate?.push_token) {
      console.log('[push-notification] No push token for receiver', { receiverId });
      return jsonResponse({ skipped: true, reason: 'no_token' })
    }

    if (receiverPrivate.is_foreground === true) {
      console.log('[push-notification] Receiver is in foreground, skipping push notification', { receiverId });
      return jsonResponse({ skipped: true, reason: 'foreground' })
    }

    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('nickname')
      .eq('id', senderId)
      .single();
    
    const senderNickname = senderProfile?.nickname || "누군가";
    const title = `${senderNickname}님의 메시지`;

    const FB_SERVICE_ACCOUNT = getFirebaseServiceAccount();
    const accessToken = await getAccessToken(FB_SERVICE_ACCOUNT);

    const fcmV1Payload = {
      message: {
        token: receiverPrivate.push_token,
        notification: {
          title,
          body: content
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
    console.log('[push-notification] FCM v1 result', { ok: res.ok, status: res.status, messageId: message.id });

    return jsonResponse(result, { status: res.ok ? 200 : 502 });
  } catch (err) {
    console.error('[push-notification] Error', { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: 'Push notification failed' }, { status: 500 });
  }
})
