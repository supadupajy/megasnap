import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adType, company, contact, message } = await req.json();

    console.log("[send-ad-inquiry] 광고 문의 접수:", { adType, company, contact });

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPass) {
      console.error("[send-ad-inquiry] Gmail 환경변수 누락");
      return new Response(JSON.stringify({ error: "메일 설정이 되어 있지 않습니다." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adTypeLabels: Record<string, string> = {
      map: '지도 마커 광고',
      feed: '피드 광고',
      banner: '배너 광고',
      sponsored: '스폰서드 콘텐츠',
    };
    const adTypeLabel = adTypeLabels[adType] || adType;

    const htmlBody = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 28px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 8px;">Chora Ads</p>
      <h1 style="color: white; font-size: 22px; font-weight: 900; margin: 0;">새로운 광고 문의가 접수되었습니다</h1>
    </div>

    <div style="padding: 28px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; width: 120px;">
            <span style="font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">광고 유형</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <span style="font-size: 14px; font-weight: 700; color: #4f46e5;">${adTypeLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <span style="font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">회사 / 브랜드</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <span style="font-size: 14px; font-weight: 700; color: #111827;">${company}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <span style="font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">연락처</span>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <span style="font-size: 14px; font-weight: 700; color: #111827;">${contact}</span>
          </td>
        </tr>
        ${message ? `
        <tr>
          <td style="padding: 12px 0; vertical-align: top;">
            <span style="font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">추가 문의</span>
          </td>
          <td style="padding: 12px 0;">
            <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div style="background: #f9fafb; padding: 16px 28px; border-top: 1px solid #f0f0f0;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0; text-align: center;">
        이 메일은 Chora 앱의 광고 문의 폼을 통해 자동 발송되었습니다.
      </p>
    </div>
  </div>
</body>
</html>`;

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailUser,
      password: gmailPass,
    });

    await client.send({
      from: gmailUser,
      to: "chorasnap@gmail.com",
      subject: `[Chora 광고 문의] ${company} - ${adTypeLabel}`,
      html: htmlBody,
    });

    await client.close();

    console.log("[send-ad-inquiry] 이메일 전송 성공:", { company, contact });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error("[send-ad-inquiry] 오류 발생:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
