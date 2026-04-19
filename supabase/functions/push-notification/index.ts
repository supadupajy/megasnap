import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JWT } from 'https://esm.sh/google-auth-library@9'

Deno.serve(async (req) => {
  // 1. 인증 확인 (트리거에서 보낸 서비스 롤 키 확인)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    console.error('Missing Authorization header')
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
  }

  try {
    const payload = await req.json()
    const { record } = payload 
    
    if (!record || !record.receiver_id) {
      throw new Error('Invalid payload: missing record or receiver_id')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. 수신자의 푸시 토큰 가져오기
    const { data: receiver, error: userError } = await supabase
      .from('profiles')
      .select('push_token, nickname')
      .eq('id', record.receiver_id)
      .single()

    if (userError || !receiver?.push_token) {
      console.log(`No push token for user ${record.receiver_id}`)
      return new Response(JSON.stringify({ message: 'No push token found' }), { status: 200 })
    }

    // 3. Firebase 서비스 계정 설정 확인
    const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountRaw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not set in Supabase')
    }
    const FIREBASE_SERVICE_ACCOUNT = JSON.parse(serviceAccountRaw)

    // 4. 발신자 정보 가져오기
    const { data: sender } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', record.sender_id)
      .single()

    // 5. Firebase Access Token 생성
    const client = new JWT({
      email: FIREBASE_SERVICE_ACCOUNT.client_email,
      key: FIREBASE_SERVICE_ACCOUNT.private_key.replace(/\\n/g, '\n'), // 줄바꿈 처리
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    })
    const { token: accessToken } = await client.getAccessToken()

    // 6. FCM v1 API 호출
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
                sound: 'default',
                channel_id: 'default'
              }
            }
          },
        }),
      }
    )

    const result = await fcmResponse.json()
    console.log('FCM Result:', result)
    
    return new Response(JSON.stringify({ success: true, result }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Push Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})