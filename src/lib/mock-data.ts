"use client";

import { Post, User, Comment } from '@/types';
import { getYoutubeThumbnail } from './utils';

// 1. 대한민국 주요 대도시 좌표 및 경계 설정
export const MAJOR_CITIES = [
  {
    name: "서울",
    lat: 37.5665, lng: 126.9780,
    density: 1500,
    bounds: { sw: { lat: 37.4200, lng: 126.7500 }, ne: { lat: 37.7200, lng: 127.2000 } }
  },
  {
    name: "부산",
    lat: 35.1796, lng: 129.0756,
    density: 800,
    bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } }
  },
  {
    name: "인천",
    lat: 37.4563, lng: 126.7052,
    density: 600,
    bounds: { sw: { lat: 37.3500, lng: 126.4000 }, ne: { lat: 37.6500, lng: 126.8500 } }
  },
  {
    name: "대구",
    lat: 35.8714, lng: 128.6014,
    density: 500,
    bounds: { sw: { lat: 35.7500, lng: 128.4500 }, ne: { lat: 35.9500, lng: 128.7500 } }
  },
  {
    name: "대전",
    lat: 36.3504, lng: 127.3845,
    density: 400,
    bounds: { sw: { lat: 36.2000, lng: 127.2500 }, ne: { lat: 36.5000, lng: 127.5000 } }
  },
  {
    name: "광주",
    lat: 35.1595, lng: 126.8526,
    density: 400,
    bounds: { sw: { lat: 35.0500, lng: 126.7000 }, ne: { lat: 35.2500, lng: 127.0000 } }
  },
  {
    name: "울산",
    lat: 35.5384, lng: 129.3114,
    density: 300,
    bounds: { sw: { lat: 35.4000, lng: 129.1500 }, ne: { lat: 35.6500, lng: 129.4500 } }
  },
  {
    name: "제주",
    lat: 33.4996, lng: 126.5312,
    density: 600,
    bounds: { sw: { lat: 33.2000, lng: 126.1500 }, ne: { lat: 33.5500, lng: 126.9500 } }
  }
];

// 2. Unsplash 이미지 ID (100종류 - 도시, 감성, 풍경 위주)
export const UNSPLASH_IDS_100 = [
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
  "photo-1522071820081-009f0129c71c"
];

// 3. 유튜브 영상 ID (50종류 - K-POP 및 Pop 공식 MV)
export const YOUTUBE_IDS_50 = [
  "gdZLi9hhztQ", "WMweEpGlu_U", "mH0_XpSHkZo", "Hbb5GPxXF1w", "v7bnOxL4LIo", // NewJeans, BTS, IVE
  "h4m-pIReA6Y", "0NCP48xaSfs", "f6YDKF0LVWw", "b_An4U8J1V4", "CuklIb9d3fI", // Pop
  "TQTlCHxyuu8", "M7lc1UVf-VE", "9bZkp7q19f0", "hTermM40EDU", "CtpT_S6-B9U",
  "IHNzOHi8sJs", "js1CtxSY38I", "d9IxdwEFk1c", "fHI8X4OXW5Q", "a5uQMwRMHcs",
  "POe9SOEKotU", "pFuJAIMQjHk", "tg2uF3R_Ozo", "UuV27Nq_Oks", "D9G1VOjua_8",
  "H5v3kku4y6Q", "gQLQDnZ0yS8", "V1Pl8CzNzCw", "dyRsYk0ViA8", "rRzxEiBLQCA",
  "kJQP7kiw5Fk", "S-sJp1FfG7Q", "u0XmZp1S-t8", "F0B7HDiY-10", "XqgYj8atJpE",
  "fE2h3lGlOsk", "0A6E0M_Z8r4", "3YqXJ7Ssh_Q", "n9N0zS5XvXw", "m8MfJg68oCs",
  "kOCkne-B8Hk", "z9n8ZzP4P8I", "XsX3ATc3FbA", "Lp_r9fX5Sfs", "7-qGKqveAnM",
  "XjJQBjWYDTs", "qV5lzRHrGeg", "2S24-y0Ij3Y", "SlPhMPnQ58k", "J6Z8WAt9v80"
];

// 4. 현실적인 댓글 데이터
export const REALISTIC_COMMENTS = [
  '여기 분위기 진짜 대박이에요! 꼭 가보세요. 😍',
  '오늘 날씨랑 찰떡인 장소 발견! 기분 전환 제대로 되네요. ✨',
  '숨은 명소 발견! 나만 알고 싶지만 공유합니다. 📍',
  '사진 찍기 너무 좋은 스팟이에요. 인생샷 건졌습니다. 📸',
  '야경이 정말 예술이네요. 밤에 꼭 가보시길 바랍니다!',
  '이 노래 들으면서 여기 있으니까 영화 주인공 된 기분이에요.',
  '플레이리스트 맛집 발견! 영상 재생해보세요.',
  '생각보다 사람이 적어서 여유롭게 즐기다 갑니다.',
  '근처 맛집 들렀다가 산책하기 딱 좋은 코스예요.',
  '친구들이랑 우정 여행 왔는데 다들 너무 좋아하네요.',
  '서울 한복판에 이런 곳이 있었다니 놀라워요.',
  '가을 정취가 물씬 느껴지는 곳입니다. 추천해요!'
];

// 5. 유틸리티 함수
export const getUnsplashUrl = (id: string) => {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800`;
};

// 6. 좌표 기반 가짜 주소 생성 (API 호출 비용 절감용)
export const getFakeAddress = (cityName: string) => {
  const districts = ["강남구", "해운대구", "연수구", "달서구", "서구", "북구", "중구", "남구"];
  const randomDistrict = districts[Math.floor(Math.random() * districts.length)];
  return `대한민국 ${cityName} ${randomDistrict} ${Math.floor(Math.random() * 500) + 1}번길`;
};

// --- 앱 필수 로직 함수 ---

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

const getTierFromId = (id: string) => {
  let h = 0;
  for(let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  const val = Math.abs(h % 1000) / 1000;
  if (val < 0.01) return 'diamond';
  if (val < 0.03) return 'gold';
  if (val < 0.07) return 'silver';
  if (val < 0.15) return 'popular';
  return 'none';
};

export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = specificUserId ? `${specificUserId}_post_${i}` : Math.random().toString(36).substr(2, 9);
    const isAd = i % 20 === 0;
    const borderType = isAd ? 'none' : getTierFromId(id);
    
    const uniqueIdx = i % UNSPLASH_IDS_100.length;
    const ytIdx = i % YOUTUBE_IDS_50.length;
    const hasYoutube = !isAd && (i % 2 === 0); 
    const youtubeId = hasYoutube ? YOUTUBE_IDS_50[ytIdx] : undefined;
    const youtubeUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined;

    let lat, lng;
    if (bounds) {
      lat = bounds.sw.lat + (randomFn() * (bounds.ne.lat - bounds.sw.lat));
      lng = bounds.sw.lng + (randomFn() * (bounds.ne.lng - bounds.sw.lng));
    } else {
      lat = centerLat + (randomFn() - 0.5) * 0.1;
      lng = centerLng + (randomFn() - 0.5) * 0.1;
    }
    
    const image = hasYoutube && youtubeUrl 
      ? (getYoutubeThumbnail(youtubeUrl) || getUnsplashUrl(UNSPLASH_IDS_100[uniqueIdx]))
      : getUnsplashUrl(UNSPLASH_IDS_100[uniqueIdx]);

    return {
      id,
      isAd,
      isGif: false,
      isInfluencer: ['silver', 'gold', 'diamond'].includes(borderType),
      user: {
        id: isAd ? 'ad_partner' : (specificUserId || id),
        name: isAd ? 'Partner' : `Explorer_${id.substring(0, 4)}`,
        avatar: `https://i.pravatar.cc/150?u=${isAd ? 'ad' : id}`,
      },
      content: REALISTIC_COMMENTS[i % REALISTIC_COMMENTS.length],
      location: '대한민국 어딘가',
      lat,
      lng,
      likes: Math.floor(randomFn() * 5000),
      commentsCount: 5,
      comments: [],
      image,
      isLiked: false,
      createdAt: new Date(Date.now() - randomFn() * 48 * 3600000),
      borderType,
      youtubeUrl
    };
  });
};

export const getUserById = (id: string): User => ({
  id,
  name: id,
  nickname: `Explorer_${id}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "탐험가입니다. 📍"
});

export const MOCK_STORIES = Array.from({ length: 10 }).map((_, i) => ({
  id: `user_${i}`,
  name: `User ${i}`,
  avatar: `https://i.pravatar.cc/150?u=user_${i}`,
  hasUpdate: Math.random() > 0.5
}));

export const MOCK_USERS = Array.from({ length: 10 }).map((_, i) => getUserById(`user_${i}`));