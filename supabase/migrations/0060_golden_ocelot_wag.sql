DELETE FROM public.posts 
WHERE user_id::text IN (SELECT id::text FROM auth.users WHERE email = 'megasnap@test.com')
AND content ILIKE '[AD]%';