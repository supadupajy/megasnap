-- 좋아요가 많은 순으로 상위 50개 포스트의 상세 상태를 확인합니다.
SELECT 
    p.id, 
    p.content, 
    p.latitude, 
    p.longitude, 
    p.user_id, 
    p.likes,
    pr.id as profile_exists,
    p.image_url
FROM 
    public.posts p
LEFT JOIN 
    public.profiles pr ON p.user_id::uuid = pr.id
ORDER BY 
    p.likes DESC
LIMIT 50;
