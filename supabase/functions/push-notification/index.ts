import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JWT } from 'https://esm.sh/google-auth-library@9'

// Firebase 서비스 계정 설정 (FCM v1 API 사용)
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}')

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const { record } = payload 

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 수신자의 푸시 토큰 가져오기
    const { data: receiver, error: userError } = await supabase
      .from('profiles')
      .select('push_token, nickname')
      .eq('id', record.receiver_id)
      .single()

    if (userError || !receiver?.push_token) {
      return new Response(JSON.stringify({ message: 'No push token found for receiver' }), { status: 200 })
    }

    // 2. 발신자 정보 가져오기
    const { data: sender } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', record.sender_id)
      .single()

    // 3. Firebase Access Token 생성
    const client = new JWT({
      email: FIREBASE_SERVICE_ACCOUNT.client_email,
      key: FIREBASE_SERVICE_ACCOUNT.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    })
    const { token: accessToken } = await client.getAccessToken()

    // 4. FCM v1 API 호출
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: receiver.push_token,
            notification: {
              title: sender?.nickname || '새 메시지',
              body: record.content,
            },
            data: {
              chatId: record.sender_id,
              type: 'chat'
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default'
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          },
        }),
      }
    )

    const result = await fcmResponse.json()
    return new Response(JSON.stringify({ success: true, result }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Push Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})