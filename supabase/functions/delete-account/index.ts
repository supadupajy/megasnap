import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // JWT 수동 검증
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // 일반 클라이언트로 토큰 검증 및 유저 확인
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error("[delete-account] 유저 인증 실패:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[delete-account] 탈퇴 요청 유저:", user.id);

    // 비밀번호 재인증
    const { password } = await req.json();
    if (!password) {
      return new Response(JSON.stringify({ error: "비밀번호가 필요합니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: user.email ?? "",
      password,
    });

    if (signInError) {
      console.error("[delete-account] 비밀번호 재인증 실패:", signInError.message);
      return new Response(JSON.stringify({ error: "비밀번호가 올바르지 않습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service Role 클라이언트로 실제 삭제
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. 관련 데이터 삭제 (RLS 우회)
    const userId = user.id;

    console.log("[delete-account] 관련 데이터 삭제 시작:", userId);

    const tables = [
      "viewed_posts",
      "saved_posts",
      "notifications",
      "messages",
      "blocks",
      "likes",
      "follows",
      "comments",
      "posts",
      "user_roles",
      "push_logs",
      "profiles",
    ];

    for (const table of tables) {
      // follows는 follower_id / following_id 두 컬럼 모두 삭제
      if (table === "follows") {
        await supabaseAdmin.from("follows").delete().eq("follower_id", userId);
        await supabaseAdmin.from("follows").delete().eq("following_id", userId);
        console.log("[delete-account] follows 삭제 완료");
        continue;
      }
      // messages는 sender_id / receiver_id 두 컬럼 모두 삭제
      if (table === "messages") {
        await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
        await supabaseAdmin.from("messages").delete().eq("receiver_id", userId);
        console.log("[delete-account] messages 삭제 완료");
        continue;
      }
      // notifications는 user_id / actor_id 두 컬럼 모두 삭제
      if (table === "notifications") {
        await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
        await supabaseAdmin.from("notifications").delete().eq("actor_id", userId);
        console.log("[delete-account] notifications 삭제 완료");
        continue;
      }
      // blocks는 blocker_id / blocked_id 두 컬럼 모두 삭제
      if (table === "blocks") {
        await supabaseAdmin.from("blocks").delete().eq("blocker_id", userId);
        await supabaseAdmin.from("blocks").delete().eq("blocked_id", userId);
        console.log("[delete-account] blocks 삭제 완료");
        continue;
      }

      const { error } = await supabaseAdmin.from(table as any).delete().eq("user_id", userId);
      if (error) {
        console.error(`[delete-account] ${table} 삭제 오류:`, error.message);
      } else {
        console.log(`[delete-account] ${table} 삭제 완료`);
      }
    }

    // 2. auth.users 삭제 (Service Role 필요)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[delete-account] auth.users 삭제 실패:", deleteError.message);
      return new Response(JSON.stringify({ error: "계정 삭제에 실패했습니다." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[delete-account] 계정 완전 삭제 완료:", userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[delete-account] 예상치 못한 오류:", err);
    return new Response(JSON.stringify({ error: "서버 오류가 발생했습니다." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
