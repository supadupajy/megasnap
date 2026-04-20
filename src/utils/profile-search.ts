import { supabase } from '@/integrations/supabase/client';

export interface ProfileSearchResult {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const searchProfilesByNickname = async (
  rawQuery: string,
  currentUserId?: string,
  limit = 20,
): Promise<ProfileSearchResult[]> => {
  const trimmedQuery = rawQuery.trim();
  if (!trimmedQuery) return [];

  const pattern = `%${escapeLikePattern(trimmedQuery)}%`;

  let query = supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio')
    .not('nickname', 'is', null)
    .ilike('nickname', pattern)
    .order('nickname', { ascending: true })
    .limit(limit);

  if (currentUserId) {
    query = query.neq('id', currentUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
};
