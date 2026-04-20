ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable RLS for update is already handled but let's make sure everyone can see online status
CREATE OR REPLACE FUNCTION public.is_user_online(last_seen_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN last_seen_timestamp > (NOW() - INTERVAL '5 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
