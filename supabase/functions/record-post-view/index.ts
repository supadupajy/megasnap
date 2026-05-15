import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const hashText = async (value: string) => {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown"
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { postId } = await req.json()
    if (!postId || typeof postId !== "string") {
      return new Response(JSON.stringify({ error: "postId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const authHeader = req.headers.get("Authorization")
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    })
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)

    const token = authHeader?.replace("Bearer ", "")
    const { data: userData } = token
      ? await anonClient.auth.getUser(token)
      : { data: { user: null } as any }
    const viewerUserId = userData.user?.id ?? null

    const { data: post, error: postError } = await serviceClient
      .from("posts")
      .select("id,user_id")
      .eq("id", postId)
      .maybeSingle()

    if (postError) throw postError
    if (!post) {
      return new Response(JSON.stringify({ error: "post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (viewerUserId && post.user_id === viewerUserId) {
      return new Response(JSON.stringify({ counted: false, reason: "own_post" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ip = getClientIp(req)
    const userAgent = req.headers.get("user-agent") || "unknown"
    const ipHash = await hashText(ip)
    const userAgentHash = await hashText(userAgent)
    const viewedHour = new Date()
    viewedHour.setMinutes(0, 0, 0)

    const { data: inserted, error: insertError } = await serviceClient
      .from("post_views")
      .insert({
        post_id: postId,
        viewer_user_id: viewerUserId,
        viewer_key: `ip:${ipHash}`,
        ip_hash: ipHash,
        user_agent_hash: userAgentHash,
        viewed_hour: viewedHour.toISOString(),
      })
      .select("id")
      .maybeSingle()

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ counted: false, reason: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      throw insertError
    }

    console.log("[record-post-view] view recorded", { postId, counted: !!inserted })

    return new Response(JSON.stringify({ counted: !!inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[record-post-view] error", { error })
    return new Response(JSON.stringify({ error: "failed to record view" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
