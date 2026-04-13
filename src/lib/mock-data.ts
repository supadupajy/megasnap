import { Post, User } from '@/types';

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1599412227383-b7d4751c8765?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1617113931036-f3039093094b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1578491252704-0696f696e981?auto=format&fit=crop&w=800&q=80",
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
  "https://images.unsplash.com/photo-1473093226795-af9932fe5855?auto=format&fit=crop&w=800&q=80"
];

const GENERAL_IMAGES = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=800&q=80"
];

const AVATAR_IMAGES = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
];

const AD_BANNER_IMAGES = [
  "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1594498653385-d5172c532c00?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=800&q=80"
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
  const avatarIndex = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_IMAGES.length;
  return {
    id,
    name: id,
    nickname: id.includes('_') ? id : `Explorer_${id}`,
    avatar: AVATAR_IMAGES[avatarIndex],
    bio: "여행과 사진을 사랑하는 탐험가입니다. 📍",
    followers: Math.floor(Math.random() * 5000) + 100,
    following: Math.floor(Math.random() * 1000) + 50,
    postsCount: Math.floor(Math.random() * 100) + 5,
    isFollowing: Math.random() > 0.8
  };
};

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    const isAd = Math.random() > 0.92;
    const isGif = !isAd && Math.random() > 0.7;
    const isInfluencer = !isAd && Math.random() > 0.85;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    let content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
    let mainImage = GENERAL_IMAGES[Math.floor(Math.random() * GENERAL_IMAGES.length)];

    if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(Math.random() * AD_FOOD_CONTENT.length)];
      mainImage = AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)];
    } else if (content.includes('교통사고') || content.includes('접촉 사고') || content.includes('도로 통제')) {
      mainImage = ACCIDENT_IMAGES[Math.floor(Math.random() * ACCIDENT_IMAGES.length)];
    } else if (content.includes('화재') || content.includes('연기') || content.includes('소방차')) {
      mainImage = FIRE_IMAGES[Math.floor(Math.random() * FIRE_IMAGES.length)];
    } else if (isGif) {
      mainImage = GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)];
    }

    // 3~4장의 랜덤 이미지 생성 (광고 삽입을 위해 최소 3장 보장)
    const imageCount = Math.floor(Math.random() * 2) + 3; 
    const images = [mainImage];
    for (let j = 1; j < imageCount; j++) {
      images.push(GENERAL_IMAGES[(Math.floor(Math.random() * GENERAL_IMAGES.length))]);
    }

    // 2번째(index 1) 또는 3번째(index 2) 위치에 광고 이미지 삽입
    const adImageIndex = Math.random() > 0.5 ? 1 : 2;
    const adImage = AD_BANNER_IMAGES[Math.floor(Math.random() * AD_BANNER_IMAGES.length)];
    images[adImageIndex] = adImage;

    const borderType = isInfluencer ? 'none' : (Math.random() > 0.8 ? 'popular' : 'none');
    const likes = (borderType === 'popular' || isInfluencer)
      ? Math.floor(Math.random() * 1001) + 1000 
      : Math.floor(Math.random() * 491) + 10;

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      user: createMockUser(isAd ? "sponsored" : id),
      content,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes,
      image: mainImage,
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
    avatar: AVATAR_IMAGES[i % AVATAR_IMAGES.length],
    hasUpdate: Math.random() > 0.3
  };
});

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`${i + 100}`));

export const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'follow',
    user: { name: 'travel_maker', avatar: AVATAR_IMAGES[0] },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2시간',
    isFollowing: false
  },
  {
    id: 2,
    type: 'like',
    user: { name: 'seoul_snap', avatar: AVATAR_IMAGES[1] },
    content: '님이 회원님의 사진을 좋아합니다.',
    time: '4시간',
    image: GENERAL_IMAGES[0]
  },
  {think
The previous response was cut off in the middle of `src/lib/mock-data.ts`. I need to complete that file and then continue with the other files that need color updates to match the new "Electric Indigo" theme.

Files to update:
1. `src/lib/mock-data.ts` (complete it)
2. `src/components/WritePost.tsx` (green -> indigo)
3. `src/components/CategoryFilter.tsx` (green -> indigo)
4. `src/components/TimeSlider.tsx` (green -> indigo)
5. `src/components/PlaceSearch.tsx` (green -> indigo)
6. `src/components/MapContainer.tsx` (green -> indigo)
7. `src/pages/Index.tsx` (green -> indigo)
8. `src/pages/Search.tsx` (green -> indigo)
9. `src/pages/Profile.tsx` (green -> indigo)
10. `src/pages/UserProfile.tsx` (green -> indigo)
11. `src/pages/Notifications.tsx` (green -> indigo)
12. `src/pages/Chat.tsx` (green -> indigo)
13. `src/components/PostItem.tsx` (green -> indigo)
14. `src/components/PostDetail.tsx` (green -> indigo)
15. `src/components/TrendingPosts.tsx` (green -> indigo)

I will start by finishing `src/lib/mock-data.ts`.

Wait, the user said "Continue exactly where you left off without any preamble."
The last line was:
`{` inside `MOCK_NOTIFICATIONS`.

Let's finish `src/lib/mock-data.ts` first.

Actually, I should probably rewrite the whole file `src/lib/mock-data.ts` to be safe, but the user asked to continue. However, `<dyad-write>` requires the full file content. I can't just "continue" inside a tag. I must provide the full file content for any file I edit.

The previous response had several `<dyad-write>` blocks.
1. `src/globals.css` - Done.
2. `src/components/BottomNav.tsx` - Done.
3. `src/components/Header.tsx` - Done.
4. `src/components/SplashScreen.tsx` - Done.
5. `src/lib/mock-data.ts` - Cut off.

I will rewrite `src/lib/mock-data.ts` completely and then proceed with the rest.

Wait, the user's prompt "Continue exactly where you left off" usually implies I should just finish the text, but since I'm an AI editor using specific tags, I must provide the full file content in a `<dyad-write>` tag.

Let's list all remaining files that need green -> indigo conversion.
- `src/components/WritePost.tsx`
- `src/components/CategoryFilter.tsx`
- `src/components/TimeSlider.tsx`
- `src/components/PlaceSearch.tsx`
- `src/components/MapContainer.tsx`
- `src/pages/Index.tsx`
- `src/pages/Search.tsx`
- `src/pages/Profile.tsx`
- `src/pages/UserProfile.tsx`
- `src/pages/Notifications.tsx`
- `src/pages/Chat.tsx`
- `src/components/PostItem.tsx`
- `src/components/PostDetail.tsx`
- `src/components/TrendingPosts.tsx`

I'll start with `src/lib/mock-data.ts`.<dyad-write path="src/lib/mock-data.ts" description="스토리 그라데이션 및 모크 데이터 색상 변경">
import { Post, User } from '@/types';

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1599412227383-b7d4751c8765?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1617113931036-f3039093094b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1578491252704-0696f696e981?auto=format&fit=crop&w=800&q=80",
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

const GENERAL_IMAGES = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=800&q=80"
];

const AVATAR_IMAGES = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
];

const AD_BANNER_IMAGES = [
  "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1594498653385-d5172c532c00?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=800&q=80"
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
  const avatarIndex = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_IMAGES.length;
  return {
    id,
    name: id,
    nickname: id.includes('_') ? id : `Explorer_${id}`,
    avatar: AVATAR_IMAGES[avatarIndex],
    bio: "여행과 사진을 사랑하는 탐험가입니다. 📍",
    followers: Math.floor(Math.random() * 5000) + 100,
    following: Math.floor(Math.random() * 1000) + 50,
    postsCount: Math.floor(Math.random() * 100) + 5,
    isFollowing: Math.random() > 0.8
  };
};

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    const isAd = Math.random() > 0.92;
    const isGif = !isAd && Math.random() > 0.7;
    const isInfluencer = !isAd && Math.random() > 0.85;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    let content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
    let mainImage = GENERAL_IMAGES[Math.floor(Math.random() * GENERAL_IMAGES.length)];

    if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(Math.random() * AD_FOOD_CONTENT.length)];
      mainImage = AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)];
    } else if (content.includes('교통사고') || content.includes('접촉 사고') || content.includes('도로 통제')) {
      mainImage = ACCIDENT_IMAGES[Math.floor(Math.random() * ACCIDENT_IMAGES.length)];
    } else if (content.includes('화재') || content.includes('연기') || content.includes('소방차')) {
      mainImage = FIRE_IMAGES[Math.floor(Math.random() * FIRE_IMAGES.length)];
    } else if (isGif) {
      mainImage = GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)];
    }

    // 3~4장의 랜덤 이미지 생성 (광고 삽입을 위해 최소 3장 보장)
    const imageCount = Math.floor(Math.random() * 2) + 3; 
    const images = [mainImage];
    for (let j = 1; j < imageCount; j++) {
      images.push(GENERAL_IMAGES[(Math.floor(Math.random() * GENERAL_IMAGES.length))]);
    }

    // 2번째(index 1) 또는 3번째(index 2) 위치에 광고 이미지 삽입
    const adImageIndex = Math.random() > 0.5 ? 1 : 2;
    const adImage = AD_BANNER_IMAGES[Math.floor(Math.random() * AD_BANNER_IMAGES.length)];
    images[adImageIndex] = adImage;

    const borderType = isInfluencer ? 'none' : (Math.random() > 0.8 ? 'popular' : 'none');
    const likes = (borderType === 'popular' || isInfluencer)
      ? Math.floor(Math.random() * 1001) + 1000 
      : Math.floor(Math.random() * 491) + 10;

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      user: createMockUser(isAd ? "sponsored" : id),
      content,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes,
      image: mainImage,
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
    avatar: AVATAR_IMAGES[i % AVATAR_IMAGES.length],
    hasUpdate: Math.random() > 0.3
  };
});

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`${i + 100}`));

export const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'follow',
    user: { name: 'travel_maker', avatar: AVATAR_IMAGES[0] },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2시간',
    isFollowing: false
  },
  {
    id: 2,
    type: 'like',
    user: { name: 'seoul_snap', avatar: AVATAR_IMAGES[1] },
    content: '님이 회원님의 사진을 좋아합니다.',
    time: '4시간',
    image: GENERAL_IMAGES[0]
  },
  {
    id: 3,
    type: 'comment',
    user: { name: 'explorer_kim', avatar: AVATAR_IMAGES[2] },
    content: '님이 댓글을 남겼습니다: "여기 진짜 예쁘네요! 어디인가요?"',
    time: '1일',
    image: GENERAL_IMAGES[1]
  },
  {
    id: 4,
    type: 'follow',
    user: { name: 'nature_lover', avatar: AVATAR_IMAGES[3] },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2일',
    isFollowing: true
  }
];