import { Post, User, Comment } from '@/types';

const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1597328290883-50c5787b7c7e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1566241440091-ec10df8db2e1?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8?auto=format&fit=crop&w=800&q=80"
];

const FIRE_IMAGES = [
  "https://images.unsplash.com/photo-1516533075015-a3838414c3cb?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1544097691-43906956f33a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1580130281216-33b442453299?auto=format&fit=crop&w=800&q=80"
];

const AD_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80"
];

const ANIMAL_IMAGES = [
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80"
];

const COMMENT_TEXTS = [
  "와 여기 진짜 가보고 싶었는데! 정보 감사합니다.",
  "날씨 좋을 때 가면 최고죠 ㅎㅎ",
  "주차 공간은 넉넉한가요?",
  "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!",
  "대박... 분위기 미쳤다",
  "여기 커피 맛집인가요?",
  "이번 주말에 가봐야겠어요!",
  "사진 너무 잘 찍으시네요 부러워요 ㅠㅠ",
  "꿀팁 감사합니다! 저장해둘게요.",
  "혹시 사람 많나요? 웨이팅 길까봐 걱정되네요.",
  "우와... 색감이 예술이네요.",
  "저도 여기 가봤는데 진짜 좋더라구요!",
  "근처에 맛집도 추천해주실 수 있나요?",
  "풍경이 너무 평화로워 보여요.",
  "인생샷 명소 인정합니다 👍",
  "조심하세요! 정보 공유 감사합니다.",
  "사고 소식 안타깝네요... 다들 안전운전!",
  "너무귀여워요!! 심쿵... 🐾",
  "반려동물 동반 가능한가요?",
  "오늘 하루도 화이팅하세요!",
  "좋은 정보 감사합니다.",
  "여기 노키즈존인가요?",
  "밤에 가면 더 예쁠 것 같아요.",
  "공유해주셔서 감사합니다!",
  "사진 보니까 당장 떠나고 싶네요.",
  "와... 진짜 힐링되네요.",
  "멋진 사진 감사합니다!",
  "여기 위치가 정확히 어디쯤인가요?",
  "다음에 꼭 가봐야겠어요.",
  "분위기 깡패네요 진짜 ㅋㅋ",
  "추천해주셔서 바로 저장했습니다!",
  "사진 작가님이신가요? 퀄리티가 ㄷㄷ",
  "오늘도 좋은 하루 되세요!",
  "항상 잘 보고 있습니다.",
  "응원합니다! 화이팅!",
  "정보 최고예요!!",
  "덕분에 좋은 곳 알아가요.",
  "가족들이랑 가기 좋을까요?",
  "데이트 코스로 딱이네요.",
  "혼자 가도 괜찮을까요?",
  "조용히 책 읽기 좋을 것 같아요.",
  "음악 선곡도 궁금하네요.",
  "직원분들 친절하신가요?",
  "가격대는 어느 정도인가요?",
  "메뉴 추천 부탁드려요!",
  "비 오는 날 가도 운치 있을 듯.",
  "눈 오면 진짜 예쁘겠어요.",
  "계절마다 가보고 싶은 곳이네요."
];

const COMMENT_USERS = [
  "travel_maker", "seoul_snap", "explorer_kim", "nature_lover", "daily_life",
  "photo_master", "wander_lust", "urban_explorer", "blue_sky", "golden_hour",
  "mystic_trip", "vivid_memory", "silent_walker", "epic_view", "nova_star",
  "luna_moon", "atlas_map", "flow_river", "pixel_art", "cloud_nine"
];

const generateRandomComments = (count: number): Comment[] => {
  const comments: Comment[] = [];
  // 성능을 위해 실제 배열에는 최대 20개까지만 담되, count가 작으면 그만큼만 생성
  const numToGenerate = Math.min(count, 20); 
  
  for (let i = 0; i < numToGenerate; i++) {
    comments.push({
      user: COMMENT_USERS[Math.floor(Math.random() * COMMENT_USERS.length)],
      text: COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)]
    });
  }
  return comments;
};

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
  "바다 냄채가 너무 좋아요 🌊",
  "도심 속 힐링 공간 발견! 🏙️",
  "커피 한 잔의 여유 ☕",
  "⚠️ 근처에서 큰 교통사고가 났네요. 다들 조심하세요! 🚗💥",
  "🔥 화재 사고 현장입니다. 소방차가 많이 와있어요. 🚒",
  "🚧 도로 통제 중입니다. 이 구간 지나시는 분들 우회하세요!",
  "💨 연기가 많이 나고 있어요. 근처 계신 분들 마스크 착용하세요!",
  "🚑 구급차가 지나가고 있습니다. 길 터주기 부탁드려요!",
  "📍 실시간 사고 제보: 사거리에서 접촉 사고 발생했습니다.",
  "우리 집 강아지랑 공원 산책 중! 너무 귀엽죠? 🐶",
  "길 가다 만난 고양이... 심쿵사 할 뻔 했어요 🐱",
  "반려동물 동반 가능한 카페 발견! 분위기 너무 좋아요 🐾",
  "오늘의 댕댕이 일기: 잔디밭에서 신나게 뛰놀기! 🐕"
];

export const GIF_POOL = [
  "https://mblogthumb-phinf.pstatic.net/MjAxOTA0MjFfMjc4/MDAxNTU1ODE0NDE0ODU3.drWDdLbQz1d0s0965X4GOXgVGHrw-tMnEbSc0s6yapQg.aub3hwUuijNYHfXtj26ma9NR8kYL_IceNILS9Miv9aIg.GIF.parkamsterdam/IMG_2021.GIF?type=w800",
  "https://i.namu.wiki/i/3qjMoSXb8qZqYZsH-vdZNRkdOaz4ypVfoRZHAj7QT9JDv1fpP7mi9Sike6ij1d6Vd42Lu-__INRCmsJJaiDx0w.gif",
  "https://coinpick.com/files/attach/images/69383/503/069/2e8cefa582dc5e9d8188aa192cf387ce.gif",
  "https://i2.ruliweb.com/cmt/20/11/04/1759234a25446f609.gif",
  "https://dszw1qtcnsa5e.cloudfront.net/community/20200910/cb182eb1-7d92-4bba-b9f1-e2ba799e497f/SmartSelect20190919000029YouTubeVanced.gif",
  "https://extmovie.com/files/attach/images/148/628/892/079/c1ae2021ee768de37fe0cc554226a7e9.gif",
  "https://talkimg.imbc.com/TVianUpload/tvian/TViews/image/2020/01/19/82PJLFUPvF67637150471087374630.gif",
  "http://cfile298.uf.daum.net/original/216A1C475799E34808B225",
  "https://i.makeagif.com/media/6-30-2021/S02tQQ.gif",
  "https://i2.ruliweb.com/ori/17/09/21/15ea2c326711457e3.gif",
  "https://img.extmovie.com/files/attach/images/148/853/595/037/97871ad291a6b65b79a971d59f75e02e.gif",
  "https://coinpick.com/files/attach/images/69383/807/070/55eb4883efd402e4b29858c545192fb1.gif",
  "https://cf.channel.io/document/spaces/8276/articles/25059/revisions/37007/usermedia/66b3b5398a260dfef490",
  "https://cdn.imweb.me/thumbnail/20181125/5bfa6ab8ceeee.gif",
  "https://upload3.inven.co.kr/upload/2025/04/26/bbs/i0827433132.gif"
];

export const isGifUrl = (url: string) => {
  if (!url) return false;
  return GIF_POOL.includes(url) || url.toLowerCase().includes('.gif');
};

const LOCATIONS = ['서울 성수동', '제주 애월', '부산 해운대', '강릉 안목해변', '경주 황리단길', '홍대입구', '여의도 한강공원'];

export const createMockUser = (id: string): User => {
  let nickname = `Explorer_${id}`;
  if (id === 'me') nickname = 'Dyad_Explorer';

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
  return createMockUser(id);
};

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    const isInfluencer = Math.random() > 0.9;
    const isPopular = Math.random() > 0.85;
    const isAd = !isInfluencer && !isPopular && Math.random() > 0.92;
    const isGif = !isAd && !isInfluencer && !isPopular && Math.random() > 0.85;
    
    const lat = centerLat + (Math.random() - 0.5) * 0.05;
    const lng = centerLng + (Math.random() - 0.5) * 0.05;
    
    let content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
    let category: 'food' | 'accident' | 'place' | 'animal' | 'none' = 'none';

    const cokeAdImg = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";
    let images = [`https://picsum.photos/seed/${id}/800/800`, cokeAdImg];

    if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(Math.random() * AD_FOOD_CONTENT.length)];
      images = [AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)], cokeAdImg];
      category = 'food';
    } else if (isGif) {
      images = [GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)], cokeAdImg];
    }

    // 댓글 수 생성 로직 (최소 10개 보장)
    let commentsCount = 0;
    if (isPopular || isInfluencer) {
      commentsCount = Math.floor(Math.random() * 200) + 50; // 50~250개
    } else {
      commentsCount = Math.floor(Math.random() * 11) + 10; // 10~20개
    }

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      category,
      user: createMockUser(isAd ? "sponsored" : id),
      content,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes: (isPopular || isInfluencer) ? Math.floor(Math.random() * 1000) + 1000 : Math.floor(Math.random() * 500) + 10,
      commentsCount,
      comments: generateRandomComments(commentsCount),
      image: images[0],
      images,
      adImageIndex: 1,
      isLiked: Math.random() > 0.5,
      createdAt: new Date(Date.now() - Math.random() * 12 * 3600000),
      borderType: isPopular ? 'popular' : 'none'
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
  { id: 2, type: 'like', user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=seoul_snap' }, content: '님이 회원님의 사진을 좋아합니다.', time: '4시간', image: 'https://picsum.photos/seed/notif1/100/100' }
];