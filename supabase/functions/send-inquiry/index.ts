import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const cleanHeader = (value: unknown) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[send-inquiry] 인증 실패:', authError);
      return new Response(JSON.stringify({ error: '인증에 실패했습니다.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { category, title, content } = await req.json();
    const safeCategory = escapeHtml(category);
    const safeTitle = escapeHtml(title);
    const safeContent = escapeHtml(content);
    const safeUserEmail = escapeHtml(user.email);
    const subjectCategory = cleanHeader(category);
    const subjectTitle = cleanHeader(title);

    console.log('[send-inquiry] 문의 접수:', { category: subjectCategory, title: subjectTitle, userEmail: user.email });

    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPass) {
      console.error('[send-inquiry] Gmail 환경변수 누락');
      return new Response(JSON.stringify({ error: '메일 설정이 되어 있지 않습니다.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const htmlBody = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 28px;">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">HiBubblez Support</p>
      <h1 style="color:white;font-size:22px;font-weight:900;margin:0;">새로운 1:1 문의가 접수되었습니다</h1>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;width:100px;font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;">문의 유형</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;color:#4f46e5;">${safeCategory}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;">발신자</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;color:#111827;">${safeUserEmail}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;">제목</td>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;color:#111827;">${safeTitle}</td>
        </tr>
        <tr>
          <td style="padding:16px 0;vertical-align:top;font-size:11px;font-weight:800;color:#9ca3af;text-transform:uppercase;">내용</td>
          <td style="padding:16px 0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${safeContent}</td>
        </tr>
      </table>
    </div>
    <div style="background:#f9fafb;padding:16px 28px;border-top:1px solid #f0f0f0;">
      <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">이 메일은 HiBubblez 앱의 1:1 문의 폼을 통해 자동 발송되었습니다.</p>
    </div>
  </div>
</body>
</html>`;

    const nodemailer = await import("npm:nodemailer@6.9.9");

    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    console.log('[send-inquiry] 이메일 전송 시작...');

    await transporter.sendMail({
      from: `"HiBubblez Support" <support@hibubblez.com>`,
      to: "support@hibubblez.com",
      replyTo: user.email,
      subject: `[HiBubblez 문의] [${subjectCategory}] ${subjectTitle}`,
      html: htmlBody,
    });

    console.log('[send-inquiry] 이메일 전송 성공:', { category: subjectCategory, title: subjectTitle, userEmail: user.email });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-inquiry] 오류 발생:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
