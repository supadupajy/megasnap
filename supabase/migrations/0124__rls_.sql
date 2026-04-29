
CREATE TABLE IF NOT EXISTS public.user_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_to_terms BOOLEAN NOT NULL DEFAULT false,
  agreed_to_privacy BOOLEAN NOT NULL DEFAULT false,
  agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  terms_version TEXT NOT NULL DEFAULT '2025-05-01',
  privacy_version TEXT NOT NULL DEFAULT '2025-05-01',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_agreements" ON public.user_agreements
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_agreements" ON public.user_agreements
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_agreements" ON public.user_agreements
FOR UPDATE TO authenticated USING (auth.uid() = user_id);
