-- Add images column as a text array if it doesn't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Update RLS policies to include the new column (usually automatic but good to be aware)
-- Ensure replica identity is still FULL for realtime
ALTER TABLE public.posts REPLICA IDENTITY FULL;
