UPDATE posts 
SET image_url = 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg' 
WHERE image_url LIKE '%2349141%';

UPDATE posts 
SET images = array_replace(images, 'https://images.pexels.com/photos/2349141/pexels-photo-2349141.jpeg', 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg')
WHERE 'https://images.pexels.com/photos/2349141/pexels-photo-2349141.jpeg' = ANY(images);