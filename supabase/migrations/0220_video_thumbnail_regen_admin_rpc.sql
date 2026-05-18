CREATE OR REPLACE FUNCTION public.get_video_posts_for_thumbnail_regen()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  image_url text,
  images text[],
  video_url text,
  video_urls text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.id = auth.uid()
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.image_url,
    p.images,
    CASE
      WHEN p.video_url IS NOT NULL AND p.video_url <> '' THEN p.video_url
      WHEN p.image_url ILIKE '%.mp4' OR p.image_url ILIKE '%.mov' OR p.image_url ILIKE '%.webm' OR p.image_url ILIKE '%.m4v' THEN p.image_url
      ELSE NULL
    END AS video_url,
    COALESCE(p.video_urls, '{}'::text[]) AS video_urls
  FROM public.posts p
  WHERE
    (p.video_url IS NOT NULL AND p.video_url <> '')
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.video_urls, '{}'::text[])) AS v(url)
      WHERE v.url IS NOT NULL AND v.url <> ''
    )
    OR p.image_url ILIKE '%.mp4'
    OR p.image_url ILIKE '%.mov'
    OR p.image_url ILIKE '%.webm'
    OR p.image_url ILIKE '%.m4v'
  ORDER BY p.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_post_video_thumbnails(
  target_post_id uuid,
  next_image_url text,
  next_images text[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.id = auth.uid()
      AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  UPDATE public.posts
  SET
    image_url = next_image_url,
    images = next_images
  WHERE id = target_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_video_posts_for_thumbnail_regen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_post_video_thumbnails(uuid, text, text[]) TO authenticated;
