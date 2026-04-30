CREATE OR REPLACE FUNCTION public.get_trending_posts(limit_count integer DEFAULT 20)
 RETURNS TABLE(id uuid, content text, image_url text, images text[], location_name text, latitude double precision, longitude double precision, likes bigint, likes_per_hour bigint, category text, youtube_url text, video_url text, created_at timestamp with time zone, user_id uuid, display_user_id uuid, user_name text, user_avatar text, hot_since timestamp with time zone, is_seed_data boolean)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    p.id,
    p.content,
    p.image_url,
    p.images,
    p.location_name,
    p.latitude,
    p.longitude,
    p.likes,
    COUNT(l.id)::BIGINT AS likes_per_hour,
    p.category,
    p.youtube_url,
    p.video_url,
    p.created_at,
    p.user_id,
    p.display_user_id,
    COALESCE(pr.nickname, p.user_name) AS user_name,
    COALESCE(pr.avatar_url, p.user_avatar) AS user_avatar,
    p.hot_since,
    p.is_seed_data
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  LEFT JOIN public.likes l
    ON l.post_id = p.id
    AND l.created_at >= NOW() - INTERVAL '1 hour'
  GROUP BY p.id, pr.nickname, pr.avatar_url
  ORDER BY likes_per_hour DESC, p.likes DESC
  LIMIT limit_count;
$function$