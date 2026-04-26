DELETE FROM public.posts 
WHERE user_id::text IN (SELECT id::text FROM auth.users WHERE email = 'chorasnap@test.com')
AND content ILIKE '[AD]%';