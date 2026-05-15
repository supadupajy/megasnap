
-- 전체 posts에서 좋아요+조회수 기반 상위 영상 포스트 확인
SELECT p.id, p.video_url, p.likes, 
  (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id) as view_count
FROM posts p
WHERE p.video_url IS NOT NULL AND p.video_url != ''
ORDER BY p.likes DESC
LIMIT 10;
