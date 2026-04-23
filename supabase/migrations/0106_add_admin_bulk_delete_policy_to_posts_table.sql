CREATE POLICY "Admin bulk delete" ON public.posts
FOR DELETE TO authenticated
USING (true);