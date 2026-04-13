import { Post, User } from '@/types';

const CONTENT_POOL = [
  "오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️",
  "여기 분위기 진짜 대박... 꼭 와보세요! ✨",
  "맛있는 점심 먹고 힐링 중입니다 🍱",
  "주말 여행지로 강력 추천합니다! 🚗",
  "야경이 정말 아름다운 곳이에요 🌙",
  "숨겨진 명소를 찾았습니다! 📍",
  "인생샷 건지기 딱 좋은 곳 📸"
];

const LOCATIONS = ['서울 성수동', '제주 애월', '부산 해운대', '강릉 안목해변', '경주 황리단길', '홍대입구', '여의도 한강공원'];

export const createMockUser = (id: string): User => ({
  id,
  name: `user_${id}`,
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
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    const post: Post = {
      id,
      isAd,
      user: createMockUser(isAd ? "sponsored" : id),
      content: CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes: Math.floor(Math.random() * 2000),
      image: `https://picsum.photos/seed/${id}/800/800`,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000),
      borderType: Math.random() > 0.8 ? 'popular' : 'none',
      isInfluencer: false
    };

    if (post.borderType === 'popular') post.likes += 2000;
    return post;
  });

  // 인플루언서 선정 로직
  const influencer = [...posts].filter(p => !p.isAd).sort((a, b) => b.likes - a.likes)[0];
  if (influencer) influencer.isInfluencer = true;

  return posts;
};

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`user_${i + 100}`));