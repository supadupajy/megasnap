-- 1. Check if the supabase_realtime publication exists, create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add the posts table to the supabase_realtime publication
-- This enables Realtime (INSERT, UPDATE, DELETE) for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;

-- 3. Ensure REPLICA IDENTITY is set to FULL if we need old values for UPDATE/DELETE
-- For INSERT only, DEFAULT is fine, but FULL is safer for all realtime events
ALTER TABLE public.posts REPLICA IDENTITY FULL;
