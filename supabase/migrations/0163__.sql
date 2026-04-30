
CREATE OR REPLACE FUNCTION public.get_trending_posts(limit_count INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  content TEXT,
  image_url TEXT,
  images TEXT[],
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  likes BIGINT,
  likes_per_hour BIGINT,
  category TEXT,
  youtube_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  display_user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  hot_since TIMESTAMPTZ,
  is_seed_data BOOLEAN
)
LANGUAGE SQL
STABLE
AS $$
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
    p.user_name,
    p.user_avatar,
    p.hot_since,
    p.is_seed_data
  FROM public.posts p
  LEFT JOIN public.likes l
    ON l.post_id = p.id
    AND l.created_at >= NOW() - INTERVAL '1 hour'
  GROUP BY p.id
  ORDER BY likes_per_hour DESC, p.likes DESC
  LIMIT limit_count;
$$;
