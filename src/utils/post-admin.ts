"use client";

import { supabase } from "@/integrations/supabase/client";

export const deletePostsInBounds = async (
  bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }
) => {
  const minLat = Math.min(bounds.sw.lat, bounds.ne.lat);
  const maxLat = Math.max(bounds.sw.lat, bounds.ne.lat);
  const minLng = Math.min(bounds.sw.lng, bounds.ne.lng);
  const maxLng = Math.max(bounds.sw.lng, bounds.ne.lng);

  const { data: posts, error: selectError } = await supabase
    .from('posts')
    .select('id')
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLng)
    .lte('longitude', maxLng);

  if (selectError) throw selectError;
  if (!posts || posts.length === 0) return 0;

  const ids = posts.map((post) => post.id);

  const { data: deleted, error: deleteError } = await supabase
    .from('posts')
    .delete()
    .in('id', ids)
    .select('id');

  if (deleteError) throw deleteError;

  return deleted?.length || 0;
};
