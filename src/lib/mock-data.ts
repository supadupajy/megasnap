import { Post, User, Comment } from '@/types';

// 결정론적 랜덤 함수 (씨앗 기반)
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

// 안정적인 Unsplash 이미지들
const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1597328290883-50c5787b7c7e",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537",
  "https://images.unsplash.com/photo-1566241440091-ec10df8db2e1",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8",
  "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const AD_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543",
  "https://images.unsplash.com/photo-1484723088339-0b2833a2595d"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const ANIMAL_IMAGES = [
  "https://images.unsplash.com/photo-1517841905240-472988babdf9",
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const PLACE_IMAGES = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
  "https://images.unsplash.com/photo-1500673922987-e212871fec22",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const GENERAL_POOL = [
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b",
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e",
  "https://images.unsplash.com/photo-1475924156734-496f6acc671e",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

export const GIF_POOL = [
  "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0",
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0",
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

export const isGifUrl = (url: string) => {
  if (!url) return false;
  return url.toLowerCase().includes('.gif');
};

const COMMENT_TEXTS = [
  "와 여기 진짜 가보고 싶었는데! 정보 감사합니다.",
  "날씨 좋을 때 가면 최고죠 ㅎㅎ",
  "주차 공간은 넉넉한가요?",
  "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!",
  "대박... 분위기 미쳤다"
];

const COMMENT_USERS = [
  "travel_maker", "seoul_snap", "explorer_kim", "nature_lover", "daily_life"
];

const generateRandomComments = (count: number, randomFn: () => number = Math.random): Comment[] => {
  const comments: Comment[] = [];
  const numToGenerate = Math.min(count, 30); 
  
  for (let i = 0; i < numToGenerate; i++) {
    comments.push({
      user: COMMENT_USERS[Math.floor(randomFn() * COMMENT_USERS.length)],
      text: COMMENT_TEXTS[Math.floor(randomFn() * COMMENT_TEXTS.length)]
    });
  }
  return comments;
};

const AD_FOOD_CONTENT = [
  "배고플 땐 역시 배달의민족! 지금 주문하면 첫 주문 1만원 할인 🍔",
  "오늘 저녁은 육즙 가득한 프리미엄 스테이크 어떠세요? 🥩"
];

const CONTENT_POOL = [
  "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
  "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
  "맛있는 점심 먹고 힐링 중입니다 🍱",
  "주말 여행지로 강력 추천합니다! 🚗",
  "야경이 정말 아름다운 곳이에요 🌙"
];

const LOCATIONS = ['서울 성수동', '제주 애월', '부산 해운대', '강릉 안목해변', '경주 황리단길'];

export const createMockUser = (id: string, randomFn: () => number = Math.random): User => {
  const finalId = id === 'me' ? 'Dyad_Explorer' : id;
  let nickname = `Explorer_${finalId}`;
  if (id === 'me') nickname = 'Dyad_Explorer';

  const roll = randomFn();
  let followers = Math.floor(randomFn() * 5000) + 100;
  
  // 인플루언서 확률 상향 (테스트를 위해 20%로 조정)
  if (roll > 0.8) {
    const tierRoll = randomFn();
    if (tierRoll > 0.8) followers = Math.floor(randomFn() * 5000000) + 10000000; // 다이아몬드 (10M+)
    else if (tierRoll > 0.5) followers = Math.floor(randomFn() * 4000000) + 1000000; // 골드 (1M+)
    else followers = Math.floor(randomFn() * 900000) + 100000; // 실버 (100k+)
  }

  return {
    id: finalId,
    name: finalId,
    nickname: nickname,
    avatar: `https://i.pravatar.cc/150?u=${finalId}`,
    bio: "여행과 사진을 사랑하는 탐험가입니다. 📍",
    followers,
    following: Math.floor(randomFn() * 1000) + 50,
    postsCount: Math.floor(randomFn() * 100) + 5,
    isFollowing: randomFn() > 0.8
  };
};

export const getUserById = (id: string): User => {
  return createMockUser(id);
};

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15, specificUserId?: string): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  return Array.from({ length: count }).map((_, i) => {
    const id = specificUserId ? `${specificUserId}_post_${i}` : Math.random().toString(36).substr(2, 9);
    
    // 인플루언서 확률 상향
    const isInfluencer = specificUserId ? false : randomFn() > 0.8; 
    const isPopular = specificUserId ? false : randomFn() > 0.9;
    const isAd = !specificUserId && !isInfluencer && !isPopular && randomFn() > 0.92;
    const isGif = !isAd && randomFn() > 0.85; 
    
    const lat = centerLat + (randomFn() - 0.5) * 0.04;
    const lng = centerLng + (randomFn() - 0.5) * 0.04;
    
    let content = CONTENT_POOL[Math.floor(randomFn() * CONTENT_POOL.length)] || "멋진 장소입니다! ✨";
    let category: 'food' | 'accident' | 'place' | 'animal' | 'none' = 'none';
    let images: string[] = [];

    const cokeAdImg = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";

    if (isGif) {
      const gifImg = GIF_POOL[Math.floor(randomFn() * GIF_POOL.length)];
      images = [gifImg, cokeAdImg];
      category = 'place';
    } else if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(randomFn() * AD_FOOD_CONTENT.length)];
      images = [AD_FOOD_IMAGES[Math.floor(randomFn() * AD_FOOD_IMAGES.length)], cokeAdImg];
      category = 'food';
    } else {
      const categoryRoll = randomFn();
      if (content && (content.includes('사고') || categoryRoll < 0.15)) {
        images = [ACCIDENT_IMAGES[Math.floor(randomFn() * ACCIDENT_IMAGES.length)], cokeAdImg];
        category = 'accident';
      } else if (content && (content.includes('강아지') || (categoryRoll >= 0.15 && categoryRoll < 0.35))) {
        images = [ANIMAL_IMAGES[Math.floor(randomFn() * ANIMAL_IMAGES.length)], cokeAdImg];
        category = 'animal';
      } else if (categoryRoll >= 0.35 && categoryRoll < 0.6) {
        images = [AD_FOOD_IMAGES[Math.floor(randomFn() * AD_FOOD_IMAGES.length)], cokeAdImg];
        category = 'food';
      } else if (categoryRoll >= 0.6 && categoryRoll < 0.85) {
        images = [PLACE_IMAGES[Math.floor(randomFn() * PLACE_IMAGES.length)], cokeAdImg];
        category = 'place';
      } else {
        images = [GENERAL_POOL[Math.floor(randomFn() * GENERAL_POOL.length)], cokeAdImg];
        category = 'none';
      }
    }

    const randomCount = Math.floor(randomFn() * 16) + 10;
    const comments = generateRandomComments(randomCount, randomFn);
    const user = specificUserId ? createMockUser(specificUserId, randomFn) : createMockUser(isAd ? "sponsored" : id, randomFn);

    const likes = (isPopular || isInfluencer) 
      ? Math.floor(randomFn() * 2000) + 800 
      : Math.floor(randomFn() * 500) + 10;

    let borderType: 'popular' | 'silver' | 'gold' | 'diamond' | 'none' = 'none';
    if (isInfluencer && user.followers) {
      if (user.followers >= 10000000) borderType = 'diamond';
      else if (user.followers >= 1000000) borderType = 'gold';
      else if (user.followers >= 100000) borderType = 'silver';
    } else if (likes >= 1500) {
      borderType = 'popular';
    }

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      category,
      user,
      content,
      location: LOCATIONS[Math.floor(randomFn() * LOCATIONS.length)],
      lat,
      lng,
      likes,
      commentsCount: comments.length,
      comments: comments,
      image: images[0],
      images,
      adImageIndex: 1,
      isLiked: randomFn() > 0.5,
      createdAt: new Date(Date.now() - randomFn() * 12 * 3600000),
      borderType
    };
  });
};

export const MOCK_STORIES = Array.from({ length: 15 }).map((_, i) => {
  const id = `user_${i}`;
  return { id, name: id, avatar: `https://i.pravatar.cc/150?u=${id}`, hasUpdate: Math.random() > 0.3 };
});

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`${i + 100}`));

export const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'follow', user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=travel_maker' }, content: '님이 회원님을 팔로우하기 시작했습니다.', time: '2시간', isFollowing: false },
  { id: 2, type: 'like', user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=seoul_snap' }, content: '님이 회원님의 사진을 좋아합니다.', time: '4시간', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=100&q=80' }
];