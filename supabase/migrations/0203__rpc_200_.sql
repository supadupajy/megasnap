
CREATE OR REPLACE FUNCTION public.get_popular_posts(limit_count integer DEFAULT 200)
RETURNS TABLE(
  id uuid, content text, image_url text, images text[],
  location_name text, latitude double precision, longitude double precision,
  likes bigint, view_count bigint, score integer,
  category text, youtube_url text, video_url text,
  created_at timestamp with time zone,
  user_id uuid, display_user_id uuid,
  user_name text, user_avatar text,
  hot_since timestamp with time zone, is_seed_data boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH view_counts AS (
    SELECT post_id, COUNT(*)::BIGINT AS view_count
    FROM public.post_views
    GROUP BY post_id
  ),
  all_posts AS (
    SELECT
      p.*,
      COALESCE(vc.view_count, 0)::BIGINT AS vc_count
    FROM public.posts p
    LEFT JOIN view_counts vc ON vc.post_id = p.id
  ),
  ranked AS (
    SELECT
      ap.*,
      CASE
        WHEN ap.likes > 0 THEN GREATEST(51 - RANK() OVER (ORDER BY ap.likes DESC), 0)::INTEGER
        ELSE 0
      END AS like_rank_score,
      CASE
        WHEN ap.vc_count > 0 THEN GREATEST(51 - RANK() OVER (ORDER BY ap.vc_count DESC), 0)::INTEGER
        ELSE 0
      END AS view_rank_score
    FROM all_posts ap
  )
  SELECT
    r.id, r.content, r.image_url, r.images,
    r.location_name, r.latitude, r.longitude,
    r.likes, r.vc_count AS view_count,
    (r.like_rank_score + r.view_rank_score)::INTEGER AS score,
    r.category, r.youtube_url, r.video_url,
    r.created_at, r.user_id, r.display_user_id,
    COALESCE(pr.nickname, r.user_name) AS user_name,
    COALESCE(pr.avatar_url, r.user_avatar) AS user_avatar,
    r.hot_since, r.is_seed_data
  FROM ranked r
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  ORDER BY (r.like_rank_score + r.view_rank_score) DESC, r.likes DESC, r.vc_count DESC, r.created_at DESC
  LIMIT limit_count;
$$;
