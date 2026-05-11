const HASHTAG_BODY = '[\\p{L}\\p{N}_가-힣ㄱ-ㅎㅏ-ㅣ]{1,40}';
const HASHTAG_REGEX = new RegExp(`#(${HASHTAG_BODY})`, 'gu');
const EXACT_HASHTAG_REGEX = new RegExp(`^${HASHTAG_BODY}$`, 'u');

export const normalizeHashtag = (tag: string) =>
  tag.replace(/^#+/, '').trim().toLowerCase();

export const extractHashtags = (text: string): string[] => {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const match of text.matchAll(HASHTAG_REGEX)) {
    const normalized = normalizeHashtag(match[1] ?? '');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
};

export const getSearchHashtag = (query: string) => {
  const normalized = normalizeHashtag(query);
  if (!EXACT_HASHTAG_REGEX.test(normalized)) return '';
  return normalized;
};
