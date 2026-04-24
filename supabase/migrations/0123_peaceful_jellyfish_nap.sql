-- 해당 포스팅의 날짜를 현재 시간으로 업데이트하여 시간 필터(TimeSlider)에 걸리지 않도록 함
UPDATE posts 
SET created_at = NOW() 
WHERE id = 'cebfd060-7116-4a6c-b259-b5bba3cb9d44';