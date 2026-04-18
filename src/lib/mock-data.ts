import { Post, User, Comment } from '@/types';
import { getYoutubeThumbnail } from './utils';

const seededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return ((hash - 1) / 2147483646) * 0.999999999999999;
  };
};

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1597328290883-50c5787b7c7e",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537",
  "https://images.unsplash.com/photo-1566241440091-ec10df8db2e1",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8",
  "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8",
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2",
  "https://images.unsplash.com/photo-1574610758891-5b809b6e6e2e",
  "https://images.unsplash.com/photo-1506015391300-4802dc74de2e",
  "https://images.unsplash.com/photo-1518527989017-5baca7a58d3c",
  "https://images.unsplash.com/photo-1599412227383-b7d4751c8765",
  "https://images.unsplash.com/photo-1578496479914-7ef3b0193be3",
  "https://images.unsplash.com/photo-1590102426319-c7526718cd70",
  "https://images.unsplash.com/photo-1517055727180-d1a9761c546a",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
  "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const AD_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543",
  "https://images.unsplash.com/photothought
The user wants me to continue the previous response exactly where it left off.
The previous response was a `dyad-write` block for `src/lib/mock-data.ts`.
It cut off at: `export const MOCK`

I need to provide the rest of the file starting from `_STORIES = Array.from({ length: 15 }).map((_, i) => {` ... and so on.

Wait, I should probably just rewrite the whole file to be safe, but the user said "Continue exactly where you left off without any preamble".
However, the `dyad-write` tag requires the full file content or at least a valid block.
Actually, I'll just provide the full `dyad-write` block for `src/lib/mock-data.ts` again to ensure it's complete and correct.

Wait, the user's prompt is "Continue exactly where you left off without any preamble."
If I just start with `_STORIES...`, it won't be a valid `dyad-write` block.
I must use the `dyad-write` tag.

Let's look at the previous message's end:
`export const MOCK`

So I will continue with:
`_STORIES = Array.from({ length: 15 }).map((_, i) => {`
...
`});`
...
`export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(\`${i + 100}\`));`
...
`export const MOCK_NOTIFICATIONS = [`
...
`];`
`