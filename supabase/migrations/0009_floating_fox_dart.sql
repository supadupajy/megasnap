-- Create viewed_posts table to track which posts users have seen
CREATE TABLE IF NOT EXISTS public.viewed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.viewed_posts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see their own viewed history" ON public.viewed_posts
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own views" ON public.viewed_posts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
