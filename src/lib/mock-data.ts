import { Post, User } from '@/types';

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
  "커피 한 잔의 여유 ☕"
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

export const createMockUser = (id: string): User => ({
  id,
  name: id, // user_ 접두사 제거
  nickname: `Explorer_${id}`,
  avatar: `https://i.pravatar.cc/150?u=${id}`,
  bio: "여행과 사진을 사랑하는 탐험가입니다. 📍",
  followers: Math.floor(Math.random() * 5000),
  following: Math.floor(Math.random() * 1000),
  postsCount: Math.floor(Math.random() * 100),
  isFollowing: Math.random() > 0.8
});

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15): Post[] => {
  const posts = Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    const isAd = Math.random() > 0.92;
    const isGif = !isAd && Math.random() > 0.7;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    const borderType = Math.random() > 0.8 ? 'popular' : 'none';
    
    const likes = borderType === 'popular' 
      ? Math.floor(Math.random() * 1001) + 1000 
      : Math.floor(Math.random() * 491) + 10;

    const post: Post = {
      id,
      isAd,
      isGif,
      user: createMockUser(isAd ? "sponsored" : id),
      content: CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes,
      image: isGif 
        ? GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)]
        : `https://picsum.photos/seed/${id}/800/800`,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000),
      borderType,
      isInfluencer: false
    };

    return post;
  });

  const influencer = [...posts].filter(p => !p.isAd).sort((a, b) => b.likes - a.likes)[0];
  if (influencer) influencer.isInfluencer = true;

  return posts;
};

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`${i + 100}`)); // user_ 접두사 제거

export const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'follow',
    user: { name: 'travel_maker', avatar: 'https://i.pravatar.cc/150?u=1' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2시간',
    isFollowing: false
  },
  {
    id: 2,
    type: 'like',
    user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=2' },
    content: '님이 회원님의 사진을 좋아합니다.',
    time: '4시간',
    image: 'https://picsum.photos/seed/notif1/100/100'
  },
  {
    id: 3,
    type: 'comment',
    user: { name: 'explorer_kim', avatar: 'https://i.pravatar.cc/150?u=3' },
    content: '님이 댓글을 남겼습니다: "여기 진짜 예쁘네요! 어디인가요?"',
    time: '1일',
    image: 'https://picsum.photos/seed/notif2/100/100'
  },
  {
    id: 4,
    type: 'follow',
    user: { name: 'nature_lover', avatar: 'https://i.pravatar.cc/150?u=4' },
    content: '님이 회원님을 팔로우하기 시작했습니다.',
    time: '2일',
    isFollowing: true
  }
];