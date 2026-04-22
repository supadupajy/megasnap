UPDATE posts 
SET image_url = 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg' 
WHERE image_url LIKE '%1486337%';

UPDATE posts 
SET images = array_replace(images, 'https://images.pexels.com/photos/1486337/pexels-photo-1486337.jpeg', 'https://images.pexels.com/photos/3225517/pexels-photo-3225517.jpeg')
WHERE 'https://images.pexels.com/photos/1486337/pexels-photo-1486337.jpeg' = ANY(images);