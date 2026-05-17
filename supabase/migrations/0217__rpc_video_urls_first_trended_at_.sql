CREATE FUNCTION public.get_trending_posts(limit_count integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  content text,
  image_url text,
  images text[],
  location_name text,
  latitude double precision,
  longitude double precision,
  likes bigint,
  likes_per_hour bigint,
  views_per_hour bigint,
  trending_score integer,
  like_score integer,
  view_score integer,
  category text,
  youtube_url text,
  video_url text,
  video_urls text[],
  first_trended_at timestamp with time zone,
  created_at timestamp with time zone,
  user_id uuid,
  display_user_id uuid,
  user_name text,
  user_avatar text,
  hot_since timestamp with time zone,
  is_seed_data boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH recent_likes AS (
    SELECT post_id, COUNT(*)::BIGINT AS like_count
    FROM public.likes
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY post_id
  ),
  recent_views AS (
    SELECT post_id, COUNT(*)::BIGINT AS view_count
    FROM public.post_views
    WHERE viewed_at >= NOW() - INTERVAL '1 hour'
    GROUP BY post_id
  ),
  candidates AS (
    SELECT
      p.*,
      COALESCE(rl.like_count, 0)::BIGINT AS like_count,
      COALESCE(rv.view_count, 0)::BIGINT AS view_count
    FROM public.posts p
    LEFT JOIN recent_likes rl ON rl.post_id = p.id
    LEFT JOIN recent_views rv ON rv.post_id = p.id
    WHERE
      COALESCE(rl.like_count, 0) > 0 OR COALESCE(rv.view_count, 0) > 0
      OR p.first_trended_at IS NOT NULL
  ),
  ranked AS (
    SELECT
      c.*,
      CASE
        WHEN c.like_count > 0 THEN GREATEST(51 - RANK() OVER (ORDER BY c.like_count DESC), 0)::INTEGER
        ELSE 0
      END AS like_rank_score,
      CASE
        WHEN c.view_count > 0 THEN GREATEST(51 - RANK() OVER (ORDER BY c.view_count DESC), 0)::INTEGER
        ELSE 0
      END AS view_rank_score
    FROM candidates c
  ),
  scored AS (
    SELECT
      r.*,
      (r.like_rank_score + r.view_rank_score)::INTEGER AS total_score
    FROM ranked r
  )
  SELECT
    s.id,
    s.content,
    s.image_url,
    s.images,
    s.location_name,
    s.latitude,
    s.longitude,
    s.likes,
    s.like_count AS likes_per_hour,
    s.view_count AS views_per_hour,
    s.total_score AS trending_score,
    s.like_rank_score AS like_score,
    s.view_rank_score AS view_score,
    s.category,
    s.youtube_url,
    s.video_url,
    s.video_urls,
    s.first_trended_at,
    s.created_at,
    s.user_id,
    s.display_user_id,
    COALESCE(pr.nickname, s.user_name) AS user_name,
    COALESCE(pr.avatar_url, s.user_avatar) AS user_avatar,
    s.hot_since,
    s.is_seed_data
  FROM scored s
  LEFT JOIN public.profiles pr ON pr.id = s.user_id
  ORDER BY s.total_score DESC, s.like_count DESC, s.view_count DESC, s.likes DESC, s.created_at DESC
  LIMIT limit_count;
$$;