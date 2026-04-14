import { Post, User } from '@/types';

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1597328290883-50c5787b7c7e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1566241440091-ec10df8db2e1?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=800&q=80"
];

const FIRE_IMAGES = [
  "https://images.unsplash.com/photo-1516533075015-a3838414c3cb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1544097691-43906956f33a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1580130281216-33b442453299?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80"
];

const AD_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1484723088339-0b2833a2595d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=800&q=80"
];

const AD_FOOD_CONTENT = [
  "배고플 땐 역시 배달의민족! 지금 주문하면 첫 주문 1만원 할인 🍔",
  "오늘 저녁은 육즙 가득한 프리미엄 스테이크 어떠세요? 🥩",
  "입안 가득 퍼지는 달콤함, 신메뉴 디저트 출시! 🍰",
  "주말엔 가족과 함께 맛있는 피자 파티! 🍕 지금 주문하세요.",
  "신선한 재료로 만든 건강한 한 끼, 샐러드 정기 배송 서비스 🥗"
];

const CONTENT_POOL = [
  "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
  "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
  "맛있는 점심 먹고 힐링 중입니다 🍱",
  "주말 여행지로 강력 추천합니다! 🚗",
  "야경이 정말 아름다운 곳이에요 🌙",
  "숨겨진 명소를 찾았습니다! 📍",
  "인생샷 건지기 딱 좋은 곳 📸",
  "바다 냄새가 너무 좋아요 🌊",
  "도심 속 힐링 공간 발견! 🏙️",
  "커피 한 잔의 여유 ☕",
  "⚠️ 근처에서 큰 교통사고가 났네요. 다들 조심하세요! 🚗💥",
  "🔥 화재 사고 현장입니다. 소방차가 많이 와있어요. 🚒",
  "🚧 도로 통제 중입니다. 이 구간 지나시는 분들 우회하세요!",
  "💨 연기가 많이 나고 있어요. 근처 계신 분들 마스크 착용하세요!",
  "🚑 구급차가 지나가고 있습니다. 길 터주기 부탁드려요!",
  "📍 실시간 사고 제보: 사거리에서 접촉 사고 발생했습니다."
];

const GIF_POOL = [
  "https://media.giphy.com/media/3o7TKMGpxpf4T9V6N2/giphy.gif",
  "https://media.giphy.com/media/l0HlO3BJ8LALPW4sE/giphy.gif",
  "https://media.giphy.com/media/3o7TKVUn7iM8FMEU24/giphy.gif",
  "https://media.giphy.com/media/l2JIdnF6aJUMsgWzu/giphy.gif",
  "https://media.giphy.com/media/3o7TKv6uSgDEPLux5m/giphy.gif",
  "https://media.giphy.com/media/3o7TKDkDbIDJieKbVm/giphy.gif",
  "https://media.giphy.com/media/3o7TKFv7m2SxxEUK9a/giphy.gif",
  "https://media.giphy.com/media/3o7TKU8rvQuK6iE9Uc/giphy.gif",
  "https://media.giphy.com/media/3o7TKv6uSDEPLux5m/giphy.gif",
  "https://media.giphy.com/media/l2JIdnF6aJUMsgWzu/giphy.gif"
];

const LOCATIONS = ['서울 성수동', '제주 애월', '부산 해운대', '강릉 안목해변', '경주 황리단길', '홍대입구', '여의도 한강공원'];

const USERNAME_PARTS = [
  'pixel', 'snap', 'wander', 'cloud', 'urban', 'wild', 'blue', 'golden', 
  'mystic', 'vivid', 'silent', 'epic', 'nova', 'luna', 'atlas', 'flow'
];

export const createMockUser = (id: string): User => {
  let nickname = `Explorer_${id}`;
  if (id.includes('_')) {
    nickname = id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  } else if (id === 'me') {
    nickname = 'Dyad_Explorer';
  }

  return {
    id,
    name: id,
    nickname: nickname,
    avatar: `https://i.pravatar.cc/150?u=${id}`,
    bio: "여행과 사진을 사랑하는 탐험가입니다. 📍",
    followers: Math.floor(Math.random() * 5000) + 100,
    following: Math.floor(Math.random() * 1000) + 50,
    postsCount: Math.floor(Math.random() * 100) + 5,
    isFollowing: Math.random() > 0.8
  };
};

export const getUserById = (id: string): User => {
  const found = MOCK_USERS.find(u => u.id === id);
  if (found) return found;
  return createMockUser(id);
};

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15): Post[] => {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const influencerIndex = indices[0];
  const popularCount = Math.floor(Math.random() * 2) + 2;
  const popularIndices = new Set(indices.slice(1, 1 + popularCount));

  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    const isInfluencer = i === influencerIndex;
    const isPopular = popularIndices.has(i);
    const isAd = !isInfluencer && !isPopular && Math.random() > 0.92;
    const isGif = !isAd && !isInfluencer && !isPopular && Math.random() > 0.8;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    let content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
    let category: 'food' | 'accident' | 'place' | 'none' = 'none';

    // 코카콜라 광고 이미지
    const cokeAdImg = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";

    // 기본적으로 3장의 이미지를 생성 (두 번째는 코카콜라 광고)
    let images = [
      `https://picsum.photos/seed/${id}-1/800/800`,
      cokeAdImg,
      `https://picsum.photos/seed/${id}-3/800/800`
    ];
    const adImageIndex = 1;

    if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(Math.random() * AD_FOOD_CONTENT.length)];
      const adImg = AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)];
      images = [adImg, cokeAdImg, `https://picsum.photos/seed/${id}-3/800/800`];
      category = 'food';
    } else if (content.includes('교통사고') || content.includes('접촉 사고') || content.includes('도로 통제')) {
      const accImg = ACCIDENT_IMAGES[Math.floor(Math.random() * ACCIDENT_IMAGES.length)];
      images = [accImg, cokeAdImg, `https://picsum.photos/seed/${id}-3/800/800`];
      category = 'accident';
    } else if (content.includes('화재') || content.includes('연기') || content.includes('소방차')) {
      const fireImg = FIRE_IMAGES[Math.floor(Math.random() * FIRE_IMAGES.length)];
      images = [fireImg, cokeAdImg, `https://picsum.photos/seed/${id}-3/800/800`];
      category = 'accident';
    } else if (content.includes('점심') || content.includes('카페') || content.includes('맛집') || content.includes('커피')) {
      category = 'food';
    } else if (content.includes('명소') || content.includes('공원') || content.includes('바다') || content.includes('야경')) {
      category = 'place';
    } else if (isGif) {
      const gifImg = GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)];
      images = [gifImg, cokeAdImg, `https://picsum.photos/seed/${id}-3/800/800`];
    }

    const borderType = isPopular ? 'popular' : 'none';
    const likes = (isPopular || isInfluencer)
      ? Math.floor(Math.random() * 1001) + 1000 
      : Math.floor(Math.random() * 491) + 10;

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      category,
      user: getUserById(isAd ? "sponsored" : id),
      content,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes,
      image: images[0],
      images,
      adImageIndex,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000),
      borderType
    };
  });
};

export const MOCK_STORIES = Array.from({ length: 15 }).map((_, i) => {
  const part1 = USERNAME_PARTS[i % USERNAME_PARTS.length];
  const part2 = USERNAME_PARTS[(i + 5) % USERNAME_PARTS.length];
  const id = `${part1}_${part2}${i > 9 ? i : '0' + i}`;
  
  return {
    id,
    name: id,
    avatar: `https://i.pravatar.cc/150?u=${id}`,
    hasUpdate: Math.random() > 0.3
  };
});

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`${i + 100}`));

export const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'follow',
    user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=travel_maker' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2시간',
    isFollowing: false
  },
  {
    id: 2,
    type: 'like',
    user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=seoul_snap' },
    content: '님이 회원님의 사진을 좋아합니다.',
    time: '4시간',
    image: 'https://picsum.photos/seed/notif1/100/100'
  },
  {
    id: 3,
    type: 'comment',
    user: { name: 'explorer_kim', avatar: 'https://i.pravatar.cc/150?u=explorer_kim' },
    content: '님이 댓글을 남겼습니다: "여기 진짜 예쁘네요! 어디인가요?"',
    time: '1일',
    image: 'https://picsum.photos/seed/notif2/100/100'
  },
  {
    id: 4,
    type: 'follow',
    user: { name: 'nature_lover', avatar: 'https://i.pravatar.cc/150?u=nature_lover' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2일',
    isFollowing: true
  }
];