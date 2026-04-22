UPDATE posts 
SET image_url = 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg' 
WHERE image_url LIKE '%45201/kitty-cat-baby-akitas%';

UPDATE posts 
SET images = array_replace(images, 'https://images.pexels.com/photos/45201/kitty-cat-baby-akitas-45201.jpeg', 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg')
WHERE 'https://images.pexels.com/photos/45201/kitty-cat-baby-akitas-45201.jpeg' = ANY(images);