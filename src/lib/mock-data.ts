"use client";

import { Post, User } from '@/types';
import { getYoutubeThumbnail } from './utils';
import { resolveOfflineLocationName } from '@/utils/offline-location';

const buildUniquePool = (items: readonly string[]) => Array.from(new Set(items));

const stableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
};

const seededRandom = (seed: string) => {
  let hash = stableHash(seed) || 1;
  return () => {
    hash = (hash * 16807) % 2147483647;
    return ((hash - 1) / 2147483646) * 0.999999999999999;
  };
};

const getTierFromId = (id: string) => {
  const val = (stableHash(id) % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

export const validateYoutubeVideo = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return response.ok;
  } catch {
    return false;
  }
};

export const YOUTUBE_IDS_50 = [
  "gdZLi9hhztQ", "js1CtxSY38I", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo",
  "WMweEpGlu_U", "kCELZbeS09o", "d9IxdwEFk1c", "9bZkp7q19f0", "hTermM40EDU",
  "CtpT_S6-B9U", "TQTlCHxyuu8", "M7lc1UVf-VE", "pFuJAIMQjHk", "tg2uF3R_Ozo",
  "UuV27Nq_Oks", "D9G1VOjua_8", "IHNzOHi8sJs", "fHI8X4OXW5Q", "a5uQMwRMHcs",
  "POe9SOEKotU", "V1Pl8CzNzCw", "gQLQDnZ0yS8", "dyRsYk0ViA8", "rRzxEiBLQCA",
  "f6YDF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", "0NCP48xaSfs", "h4m-pIReA6Y",
  "kJQP7kiw5Fk", "S-sJp1FfG7Q", "u0XmZp1S-t8", "F0B7HDiY-10", "XqgYj8atJpE",
  "fE2h3lGlOsk", "0A6E0M_Z8r4", "3YqXJ7Ssh_Q", "n9N0zS5XvXw", "m8MfJg68oCs",
  "kOCkne-B8k", "z9n8ZzP4P8I", "XsX3ATc3FbA", "Lp_r9fX5Sfs", "7-qGKqveAnM",
  "XjJQBjWYDTs", "qV5lzRHrGeg", "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80",
] as const;

export const YOUTUBE_LINKS = YOUTUBE_IDS_50.map((id) => `https://www.youtube.com/shorts/${id}`);

let validYoutubeIds: string[] = [...YOUTUBE_IDS_50];
let youtubePoolPromise: Promise<void> | null = null;

export const initializeYoutubePool = async () => {
  if (youtubePoolPromise) return youtubePoolPromise;

  youtubePoolPromise = (async () => {
    console.log("🚀 [YouTube] 영상 50종 정책 검증 시작...");
    const checkResults = await Promise.all(
      YOUTUBE_IDS_50.map(async (id) => ({ id, ok: await validateYoutubeVideo(id) })),
    );
    const filtered = checkResults.filter((result) => result.ok).map((result) => result.id);

    if (filtered.length > 0) {
      validYoutubeIds = filtered;
      console.log(`✅ [YouTube] ${validYoutubeIds.length}개의 클린 영상 확보 완료!`);
    } else {
      console.warn("⚠️ [YouTube] 검증된 영상이 없습니다. 기본 리스트를 유지합니다.");
    }
  })();

  return youtubePoolPromise;
};

export const getVerifiedYoutubeUrlByIndex = (index: number) => {
  const pool = validYoutubeIds.length > 0 ? validYoutubeIds : YOUTUBE_IDS_50;
  return `https://www.youtube.com/watch?v=${pool[Math.abs(index) % pool.length]}`;
};

const GENERAL_UNSPLASH_IDS_RAW = [
  "photo-1444723126603-3e059c60c01e", "photo-1477959858617-67f85cf4f1df", "photo-1464822759023-fed622ff2c3b",
  "photo-1514924013411-cbf25faa35bb", "photo-1493246507139-91e8bef99c02", "photo-1469474968028-56623f02e42e",
  "photo-1501785888041-af3ef285b470", "photo-1470071459604-3b5ec3a7fe05", "photo-1441974231531-c6227db76b6e",
  "photo-1532274402911-5a369e4c4bb5", "photo-1506744038136-46273834b3fb", "photo-1465146344425-f00d5f5c8f07",
  "photo-1472214103451-9374bd1c798e", "photo-1426604966848-d7adac402bff", "photo-1414235077428-338989a2e8c0",
  "photo-1504674900247-0877df9cc836", "photo-1493770348161-369560ae357d", "photo-1476224203421-9ac3993c4c5a",
  "photo-1504439468489-c8920d796a29", "photo-1482049016688-2d3e1b311543", "photo-1512621776951-a57141f2eefd",
  "photo-1517248135467-4c7edcad34c4", "photo-1552566626-52f8b828add9", "photo-1555939594-58d7cb561ad1",
  "photo-1551218808-94e220e084d2", "photo-1565299624946-b28f40a0ae38", "photo-1567620905732-2d1ec7bb7445",
  "photo-1546069901-ba9599a7e63c", "photo-1565958011703-44f9829ba187", "photo-1484723091739-30a097e8f929",
  "photo-1519708227418-c8fd9a32b7a2", "photo-1529042410759-bf9390279d2b", "photo-1473093226795-af9932fe5856",
  "photo-1490645935967-10de6ba17051", "photo-1432139555190-58521daec20b", "photo-1540189549336-e6e99c3679fe",
  "photo-1498837167922-ddd27525d352", "photo-1543353071-873f17a7a088", "photo-1506354666786-959d6d497f1a",
  "photo-1511690656952-34342bb7c2f2", "photo-1495195129352-aec325b55b65", "photo-1481671703460-040cb8a2d909",
  "photo-1470252649358-96753a782901", "photo-1447752875215-b2761acb3c5d", "photo-1465189684280-6a8fa9b19a7a",
  "photo-1433832597046-4f10e10ac764", "photo-1439066615861-d1af74d74000", "photo-1476514525535-07fb3b4ae5f1",
  "photo-1507525428034-b723cf961d3e", "photo-1519046904884-53103b34b206", "photo-1533105079780-92b9be482077",
  "photo-1501183638710-841dd1904471", "photo-1515238152791-8216bfdf89a7", "photo-1510414842594-a61c69b5ae57",
  "photo-1467232004584-a241de8bcf5d", "photo-1513584684031-43d5ec36038f", "photo-1523217582562-09d0def993a6",
  "photo-1502672260266-1c1ef2d93688", "photo-1522708323590-d24dbb6b0267", "photo-1502005229762-cf1b2da7c5d6",
  "photo-1512917774080-9991f1c4c750", "photo-1480074568708-e7b720bb3f09", "photo-1449034446853-66c86144b0ad",
  "photo-1475855581690-80accde3ae2b", "photo-1513502703549-1ad55c7d314c", "photo-1518780664697-55e3ad937233",
  "photo-1505691722718-4684375a973d", "photo-1523755231516-f43fd99bbd5a", "photo-1516455590571-18256e5bb9ff",
  "photo-1516421591134-668418183a50", "photo-1464366400600-7168b8af9bc3", "photo-1496417263034-38ec4f0b665a",
  "photo-1506057585508-85603cee9e17", "photo-1498050108023-c5249f4df085", "photo-1493612276216-ee3925520721",
  "photo-1515378791036-0648a3ef77b2", "photo-1485827404703-89b55fcc595e", "photo-1526374965328-7f61d4dc18c5",
  "photo-1531297484001-80022131f5a1", "photo-1488590528505-98d2b5aba04b", "photo-1518770660439-4636190af475",
  "photo-1550745165-9bc0b252726f", "photo-1525547719571-a2d4ac8945e2", "photo-1519389950473-47ba0277781c",
  "photo-1581091226825-a6a2a5aee158", "photo-1510511459019-5dda7724fd87", "photo-1520333789090-1afc82db536a",
  "photo-1551434678-e076c223a692", "photo-1460925895917-afdab827c52f", "photo-1497215728101-856f4ea42174",
  "photo-1522202176988-66273c2fd55f", "photo-1519244703995-f4e0f30006d5", "photo-1491438590914-bc09fcaaf77a",
  "photo-1517048676732-d65bc937f952", "photo-1556761175-b413da4baf72", "photo-1523240795612-9a054b0db644",
  "photo-1515187029135-18ee286d815b", "photo-1521737711867-e3b97375f902", "photo-1507679799987-c73779587ccf",
  "photo-1522071820081-009f0129c71c",
] as const;

const FOOD_UNSPLASH_IDS_RAW = [
  "photo-1504674900247-0877df9cc836", "photo-1493770348161-369560ae357d", "photo-1476224203421-9ac3993c4c5a",
  "photo-1504439468489-c8920d796a29", "photo-1482049016688-2d3e1b311543", "photo-1512621776951-a57141f2eefd",
  "photo-1517248135467-4c7edcad34c4", "photo-1552566626-52f8b828add9", "photo-1555939594-58d7cb561ad1",
  "photo-1551218808-94e220e084d2", "photo-1565299624946-b28f40a0ae38", "photo-1567620905732-2d1ec7bb7445",
  "photo-1546069901-ba9599a7e63c", "photo-1565958011703-44f9829ba187", "photo-1484723091739-30a097e8f929",
  "photo-1490645935967-10de6ba17051", "photo-1540189549336-e6e99c3679fe", "photo-1498837167922-ddd27525d352",
  "photo-1511690656952-34342bb7c2f2", "photo-1495195129352-aec325b55b65", "photo-1481671703460-040cb8a2d909",
  "photo-1470252649358-96753a782901", "photo-1465146344425-f00d5f5c8f07", "photo-1414235077428-338989a2e8c0",
];

const ACCIDENT_UNSPLASH_IDS_RAW = [
  "photo-1544620347-c4fd4a3d5957", "photo-1517048676732-d65bc937f952", "photo-1519244703995-f4e0f30006d5",
  "photo-1517248135467-4c7edcad34c4", "photo-1504674900247-0877df9cc836", "photo-1504439468489-c8920d796a29",
  "photo-1512917774080-9991f1c4c750", "photo-1480074568708-e7b720bb3f09", "photo-1449034446853-66c86144b0ad",
  "photo-1475855581690-80accde3ae2b", "photo-1513502703549-1ad55c7d314c", "photo-1518780664697-55e3ad937233",
  "photo-1505691722718-4684375a973d", "photo-1523755231516-f43fd99bbd5a", "photo-1516455590571-18256e5bb9ff",
  "photo-1516421591134-668418183a50", "photo-1464366400600-7168b8af9bc3", "photo-1496417263034-38ec4f0b665a",
  "photo-1506057585508-85603cee9e17", "photo-1498050108023-c5249f4df085", "photo-1493612276216-ee3925520721",
];

const PLACE_UNSPLASH_IDS_RAW = [
  "photo-1470071459604-3b5ec3a7fe05", "photo-1441974231531-c6227db76b6e", "photo-1532274402911-5a369e4c4bb5",
  "photo-1506744038136-46273834b3fb", "photo-1465146344425-f00d5f5c8f07", "photo-1472214103451-9374bd1c798e",
  "photo-1426604966848-d7adac402bff", "photo-1414235077428-338989a2e8c0", "photo-1504674900247-0877df9cc836",
  "photo-1507525428034-b723cf961d3e", "photo-1519046904884-53103b34b206", "photo-1533105079780-92b9be482077",
  "photo-1501183638710-841dd1904471", "photo-1515238152791-8216bfdf89a7", "photo-1510414842594-a61c69b5ae57",
  "photo-1467232004584-a241de8bcf5d", "photo-1513584684031-43d5ec36038f", "photo-1523217582562-09d0def993a6",
  "photo-1502672260266-1c1ef2d93688", "photo-1522708323590-d24dbb6b0267", "photo-1502005229762-cf1b2da7c5d6",
];

const ANIMAL_UNSPLASH_IDS_RAW = [
  "photo-1548199973-03cbf5292374", "photo-1518717758241-b8497f81b10c", "photo-1517849845537-4d257902454a",
  "photo-1516979187457-637abb4f9356", "photo-1514888673529-525381262790", "photo-1517331156700-3c241d2b4d80",
  "photo-1510414842594-a61c69b5ae57", "photo-1519046904884-53103b34b206", "photo-1533105079780-92b9be482077",
  "photo-1501183638710-841dd1904471", "photo-1515238152791-8216bfdf89a7", "photo-1510414842594-a61c69b5ae57",
];

export const cityThemes: Record<string, string[]> = {
  seoul: ["photo-1503899036084-c55cdd92da26", "photo-1540959733332-eab4deabeeaf", "photo-1538332576228-eb5b4c4de6f5", "photo-1535223289827-42f1e9919769"],
  busan: ["photo-1546271876-af3ef285b470", "photo-1516450360452-9312f5e86fc7", "photo-1514933651103-005eec06c04b", "photo-1441974231531-c6227db76b6e"],
  food: ["photo-1504674900247-0877df9cc836", "photo-1546069901-ba9599a7e63c", "photo-1567620905732-2d1ec7bb7445", "photo-1467003909585-2f8a72700288"],
  general: ["photo-1501785888041-af3ef285b470", "photo-1470071459604-3b5ec3a7fe05", "photo-1506744038136-46273834b3fb", "photo-1511497584788-915e57d2c9c5"]
};

// [FIX] 고장난 이미지 ID 제거 및 안전한 이미지 목록으로 교체
export const placeImages = [
  "photo-1506744038136-46273834b3fb", "photo-1518717758241-b8497f81b10c", "photo-1517849845537-4d257902454a",
  "photo-1516979187457-637abb4f9356", "photo-1514888673529-525381262790", "photo-1517331156700-3c241d2b4d80",
  "photo-1510414842594-a61c69b5ae57", "photo-1519046904884-53103b34b206", "photo-1533105079780-92b9be482077",
  "photo-1501183638710-841dd1904471", "photo-1515238152791-8216bfdf89a7", "photo-1510414842594-a61c69b5ae57",
];

export const UNSPLASH_IDS = buildUniquePool(GENERAL_UNSPLASH_IDS_RAW);
export const FOOD_UNSPLASH_IDS = buildUniquePool(FOOD_UNSPLASH_IDS_RAW);
export const ACCIDENT_UNSPLASH_IDS = buildUniquePool(ACCIDENT_UNSPLASH_IDS_RAW);
export const PLACE_UNSPLASH_IDS = buildUniquePool(PLACE_UNSPLASH_IDS_RAW);
export const ANIMAL_UNSPLASH_IDS = buildUniquePool(ANIMAL_UNSPLASH_IDS_RAW);

export const getUnsplashUrl = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const isUnsplashImageUrl = (url?: string | null) =>
  typeof url === 'string' && url.includes('images.unsplash.com');

const pickFromPool = (pool: readonly string[], seed: string, salt = 0) => {
  const baseHash = stableHash(`${seed}:${salt}`);
  const stepOptions = [7, 11, 13, 17, 19, 23, 29];
  const step = stepOptions[baseHash % stepOptions.length];
  const index = (baseHash + salt * step) % pool.length;
  return pool[index];
};

export const getDiverseUnsplashId = (
  seed: string | number,
  variant: 'general' | 'food' | 'accident' | 'place' | 'animal' = 'general',
  salt = 0,
) => {
  let pool: readonly string[];
  switch (variant) {
    case 'food':
      pool = FOOD_UNSPLASH_IDS;
      break;
    case 'accident':
      pool = ACCIDENT_UNSPLASH_IDS;
      break;
    case 'place':
      pool = PLACE_UNSPLASH_IDS;
      break;
    case 'animal':
      pool = ANIMAL_UNSPLASH_IDS;
      break;
    case 'general':
    default:
      pool = UNSPLASH_IDS;
      break;
  }
  return pickFromPool(pool, String(seed), salt);
};

export const getDiverseUnsplashUrl = (
  seed: string | number,
  variant: 'general' | 'food' | 'accident' | 'place' | 'animal' = 'general',
  salt = 0,
) => getUnsplashUrl(getDiverseUnsplashId(seed, variant, salt));

export const remapUnsplashDisplayUrl = (
  url: string | null | undefined,
  seed: string | number,
  variant: 'general' | 'food' | 'accident' | 'place' | 'animal' = 'general',
  salt = 0,
) => {
  if (!url || !isUnsplashImageUrl(url)) return url;
  return getDiverseUnsplashUrl(`${seed}:${url}`, variant, salt);
};

const CATEGORIES = ['food', 'accident', 'place', 'animal'] as const;

export const createMockPosts = (
  centerLat: number,
  centerLng: number,
  count: number = 15,
  specificUserId?: string,
  bounds?: { sw: { lat: number; lng: number }, ne: { lat: number; lng: number } },
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = specificUserId ? `${specificUserId}_post_${i}` : Math.random().toString(36).slice(2, 11);
    const isAd = i % 20 === 0;
    
    // ✅ 포스팅 종류(티어)를 다시 ID 기반의 고유한 속성으로 복구합니다.
    // 이는 좋아요 개수와는 별개인 "포스팅의 신분"입니다.
    const borderType = isAd ? 'none' : getTierFromId(id);
    const isInfluencer = !isAd && ['silver', 'gold', 'diamond'].includes(borderType);
    
    const hasYoutube = !isAd && i % 2 === 0;
    const ytId = hasYoutube ? validYoutubeIds[(stableHash(`${centerLat}:${centerLng}:${i}`)) % validYoutubeIds.length] : undefined;
    const youtubeUrl = ytId ? `https://www.youtube.com/shorts/${ytId}` : undefined;

    let lat: number;
    let lng: number;
    if (bounds) {
      lat = bounds.sw.lat + (randomFn() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (randomFn() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (randomFn() - 0.5) * 0.1;
      lng = centerLng + (randomFn() - 0.5) * 0.1;
    }

    const imageSeed = `${specificUserId || 'global'}:${centerLat}:${centerLng}:${lat.toFixed(4)}:${lng.toFixed(4)}:${i}`;
    const category = CATEGORIES[i % CATEGORIES.length]; // 카테고리 할당

    const image = isAd
      ? getDiverseUnsplashUrl(imageSeed, 'food', i)
      : youtubeUrl
        ? (getYoutubeThumbnail(youtubeUrl) || getDiverseUnsplashUrl(imageSeed, category, i)) 
        : getDiverseUnsplashUrl(imageSeed, category, i);

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer,
      category, // 카테고리 추가
      user: {
        id: isAd ? 'ad_partner' : (specificUserId || id),
        name: isAd ? 'Partner' : `Explorer_${id.substring(0, 4)}`,
        avatar: `https://i.pravatar.cc/150?u=${isAd ? 'ad' : id}`,
      },
      content: isAd ? '특별한 혜택을 만나보세요! ✨' : '오늘의 멋진 순간을 기록합니다. 📍',
      location: resolveOfflineLocationName(lat, lng),
      lat,
      lng,
      likes: Math.floor(randomFn() * 10001), 
      commentsCount: 5,
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl,
    } as Post;
  });
};

export const getUserById = (id: string): User => ({
  id,
  name: id,
  nickname: `Explorer_${id}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: '탐험가입니다. 📍',
});

export const MOCK_STORIES = Array.from({ length: 10 }).map((_, i) => ({
  id: `user_${i}`,
  name: `User ${i}`,
  avatar: `https://i.pravatar.cc/150?u=user_${i}`,
  hasUpdate: Math.random() > 0.5,
}));

export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));