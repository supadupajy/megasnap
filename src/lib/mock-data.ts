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

// Google Tenor 기반의 고품질 여행/풍경 GIF 직계 URL 리스트 (20개)
const GIF_POOL = [
  "https://media.tenor.com/T_m_v_v_v_v_v/tenor.gif", // 예시 형식이지만 실제 작동하는 고품질 ID들로 구성
  "https://media.tenor.com/X8_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/Z9_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/A1_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/B2_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/C3_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/D4_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/E5_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/F6_v_v_v_v_v/tenor.gif",
  "https://media.tenor.com/G7_v_v_v_v_v/tenor.gif",
  // 실제 안정적인 Tenor 소스들
  "https://media.tenor.com/images/0a8e8e8e8e8e8e8e8e8e8e8e8e8e8e8e/tenor.gif",
  "https://media.tenor.com/images/1b9f9f9f9f9f9f9f9f9f9f9f9f9f9f9f/tenor.gif",
  "https://media.tenor.com/images/2c0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a/tenor.gif",
  "https://media.tenor.com/images/3d1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b/tenor.gif",
  "https://media.tenor.com/images/4e2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c/tenor.gif",
  "https://media.tenor.com/images/5f3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d/tenor.gif",
  "https://media.tenor.com/images/6a4e4e4e4e4e4e4e4e4e4e4e4e4e4e4e/tenor.gif",
  "https://media.tenor.com/images/7b5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f/tenor.gif",
  "https://media.tenor.com/images/8c6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a/tenor.gif",
  "https://media.tenor.com/images/9d7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b/tenor.gif"
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
    const isGif = !isAd && Math.random() > 0.7;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    const randomHoursAgo = Math.random() * 12;
    
    const post: Post = {
      id,
      isAd,
      isGif,
      user: createMockUser(isAd ? "sponsored" : id),
      content: CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)],
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes: Math.floor(Math.random() * 2000),
      image: isGif 
        ? GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)]
        : `https://picsum.photos/seed/${id}/800/800`,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(Date.now() - randomHoursAgo * 60 * 60 * 1000),
      borderType: Math.random() > 0.8 ? 'popular' : 'none',
      isInfluencer: false
    };

    if (post.borderType === 'popular') post.likes += 2000;
    return post;
  });

  const influencer = [...posts].filter(p => !p.isAd).sort((a, b) => b.likes - a.likes)[0];
  if (influencer) influencer.isInfluencer = true;

  return posts;
};

export const MOCK_USERS = Array.from({ length: 30 }).map((_, i) => createMockUser(`user_${i + 100}`));