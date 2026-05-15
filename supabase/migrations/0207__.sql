
CREATE TABLE IF NOT EXISTS ad_saved (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ad_id, user_id)
);

ALTER TABLE ad_saved ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_saved_select_own" ON ad_saved FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ad_saved_insert_own" ON ad_saved FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ad_saved_delete_own" ON ad_saved FOR DELETE TO authenticated USING (auth.uid() = user_id);
