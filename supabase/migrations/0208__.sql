
CREATE TABLE IF NOT EXISTS ad_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_id, user_id)
);

ALTER TABLE ad_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_likes_select_all" ON ad_likes FOR SELECT USING (true);
CREATE POLICY "ad_likes_insert_own" ON ad_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ad_likes_delete_own" ON ad_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
