-- youtube_url이 있는 포스트들의 image_url을 유튜브 썸네일 패턴으로 일괄 업데이트
UPDATE posts 
SET image_url = 'https://img.youtube.com/vi/' || 
                CASE 
                  WHEN youtube_url LIKE '%watch?v=%' THEN substring(youtube_url from 'v=([^&]+)')
                  WHEN youtube_url LIKE '%shorts/%' THEN substring(youtube_url from 'shorts/([^?]+)')
                  ELSE substring(youtube_url from '([^/]+)$')
                END || '/hqdefault.jpg'
WHERE youtube_url IS NOT NULL AND youtube_url != '';
