SELECT 
  (SELECT count(*) FROM posts) as total_posts,
  (SELECT count(*) FROM posts_with_profiles) as total_view_rows,
  (SELECT json_build_object(
    'min_lat', min(latitude), 
    'max_lat', max(latitude), 
    'min_lng', min(longitude), 
    'max_lng', max(longitude)
  ) FROM posts) as data_bounds;