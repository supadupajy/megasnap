
CREATE TABLE IF NOT EXISTS ad_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ad_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_comments_select_all" ON ad_comments FOR SELECT USING (true);
CREATE POLICY "ad_comments_insert_own" ON ad_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ad_comments_update_own" ON ad_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ad_comments_delete_own" ON ad_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
