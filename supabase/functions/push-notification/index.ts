import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}')

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const { record } = payload // 새 메시지 데이터

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 수신자의 푸시 토큰 가져오기
    const { data: receiver } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', record.receiver_id)
      .single()

    if (!receiver?.push_token) {
      return new Response(JSON.stringify({ message: 'No push token found' }), { status: 200 })
    }

    // 2. 발신자 닉네임 가져오기
    const { data: sender } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', record.sender_id)
      .single()

    // 3. Firebase Access Token 생성 (OAuth2)
    // 실제 운영 환경에서는 'googleapis' 라이브러리를 사용하거나 
    // Supabase의 공식 가이드를 따라 액세스 토큰을 생성해야 합니다.
    // 여기서는 로직의 흐름을 보여드립니다.

    const message = {
      message: {
        token: receiver.push_token,
        notification: {
          title: sender?.nickname || '새 메시지',
          body: record.content,
        },
        data: {
          chatId: record.sender_id, // 클릭 시 이동할 채팅방 ID
        },
      },
    }

    // FCM v1 API 호출 로직이 여기에 들어갑니다.
    console.log('Sending push to:', receiver.push_token)

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})