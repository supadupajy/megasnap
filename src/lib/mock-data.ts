import { Post, User, Comment } from '@/types';

// 카테고리별 고화질 이미지 풀
const ACCIDENT_IMAGES = [
  "https://images.unsplash.com/photo-1597328290883-50c5787b7c7e",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537",
  "https://images.unsplash.com/photo-1566241440091-ec10df8db2e1",
  "https://images.unsplash.com/photo-1494976388531-d1058494cdd8",
  "https://images.unsplash.com/photo-1516733725897-1aa73b87c8e8",
  "https://images.unsplash.com/photo-1506015391300-4802dc74de2e",
  "https://images.unsplash.com/photo-1515524738708-327f6b0037a7",
  "https://images.unsplash.com/photo-1574672033710-069999999999"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const AD_FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543",
  "https://images.unsplash.com/photo-1484723088339-0b2833a2595d",
  "https://images.unsplash.com/photo-1473093226795-af9932fe5855",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const ANIMAL_IMAGES = [
  "https://images.unsplash.com/photo-1517841905240-472988babdf9",
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba",
  "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
  "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8",
  "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e",
  "https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a",
  "https://images.unsplash.com/photo-1518717758536-85ae29035b6d",
  "https://images.unsplash.com/photo-1548191265-cc70d3d45ba1"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const PLACE_IMAGES = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
  "https://images.unsplash.com/photo-1500673922987-e212871fec22",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e",
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const GENERAL_POOL = [
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b",
  "https://images.unsplash.com/photo-1505144808419-1957a94ca61e",
  "https://images.unsplash.com/photo-1475924156734-496f6acc671e",
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
  "https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0",
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0"
].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

export const GIF_POOL = [
  "https://mblogthumb-phinf.pstatic.net/MjAxOTA0MjFfMjc4/MDAxNTU1ODE0NDE0ODU3.drWDdLbQz1d0s0965X4GOXgVGHrw-tMnEbSc0s6yapQg.aub3hwUuijNYHfXtj26ma9NR8kYL_IceNILS9Miv9aIg.GIF.parkamsterdam/IMG_2021.GIF?type=w800",
  "https://mblogthumb-phinf.pstatic.net/MjAyMTA1MjdfMjI0/MDAxNjIyMDQ2ODc2MDA0.2UJSyRLFY0BzwFD9O2wDPNZvUAZTH3UFEujSX71iKVgg.U0MxROyEBf_Bk5zNBVzKOrDuYuIYjXSJ9zlK0V4tp70g.GIF.hssnfl/IMG_1897.GIF?type=w800",
  "https://dszw1qtcnsa5e.cloudfront.net/community/20200910/cb182eb1-7d92-4bba-b9f1-e2ba799e497f/SmartSelect20190919000029YouTubeVanced.gif",
  "https://coinpick.com/files/attach/images/69383/503/069/2e8cefa582dc5e9d8188aa192cf387ce.gif",
  "https://talkimg.imbc.com/TVianUpload/tvian/TViews/image/2020/01/19/82PJLFUPvF67637150471087374630.gif",
  "https://i.makeagif.com/media/6-30-2021/S02tQQ.gif"
];

export const isGifUrl = (url: string) => {
  if (!url) return false;
  return url.toLowerCase().includes('.gif');
};

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
  const numToGenerate = Math.min(count, 30); 
  
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

export const createMockPosts = (centerLat: number, centerLng: number, count: number = 15, specificUserId?: string): Post[] => {
  return Array.from({ length: count }).map((_, i) => {
    const id = Math.random().toString(36).substr(2, 9);
    const isInfluencer = specificUserId ? false : Math.random() > 0.98;
    const isPopular = specificUserId ? false : Math.random() > 0.95;
    const isAd = !specificUserId && !isInfluencer && !isPopular && Math.random() > 0.92;
    const isGif = !isAd && Math.random() > 0.85; 
    
    const lat = centerLat + (Math.random() - 0.5) * 0.04;
    const lng = centerLng + (Math.random() - 0.5) * 0.04;
    
    let content = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)];
    let category: 'food' | 'accident' | 'place' | 'animal' | 'none' = 'none';
    let images: string[] = [];

    const cokeAdImg = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80";

    if (isGif) {
      const gifImg = GIF_POOL[Math.floor(Math.random() * GIF_POOL.length)];
      images = [gifImg, cokeAdImg];
      category = 'place';
    } else if (isAd) {
      content = AD_FOOD_CONTENT[Math.floor(Math.random() * AD_FOOD_CONTENT.length)];
      images = [AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)], cokeAdImg];
      category = 'food';
    } else {
      const categoryRoll = Math.random();
      if (content.includes('사고') || content.includes('화재') || categoryRoll < 0.15) {
        images = [ACCIDENT_IMAGES[Math.floor(Math.random() * ACCIDENT_IMAGES.length)], cokeAdImg];
        category = 'accident';
      } else if (content.includes('강아지') || content.includes('고양이') || (categoryRoll >= 0.15 && categoryRoll < 0.35)) {
        images = [ANIMAL_IMAGES[Math.floor(Math.random() * ANIMAL_IMAGES.length)], cokeAdImg];
        category = 'animal';
      } else if (categoryRoll >= 0.35 && categoryRoll < 0.6) {
        images = [AD_FOOD_IMAGES[Math.floor(Math.random() * AD_FOOD_IMAGES.length)], cokeAdImg];
        category = 'food';
      } else if (categoryRoll >= 0.6 && categoryRoll < 0.85) {
        images = [PLACE_IMAGES[Math.floor(Math.random() * PLACE_IMAGES.length)], cokeAdImg];
        category = 'place';
      } else {
        images = [GENERAL_POOL[Math.floor(Math.random() * GENERAL_POOL.length)], cokeAdImg];
        category = 'none';
      }
    }

    const randomCount = Math.floor(Math.random() * 16) + 10;
    const comments = generateRandomComments(randomCount);

    return {
      id,
      isAd,
      isGif,
      isInfluencer,
      category,
      user: specificUserId ? createMockUser(specificUserId) : createMockUser(isAd ? "sponsored" : id),
      content,
      location: LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      lat,
      lng,
      likes: (isPopular || isInfluencer) ? Math.floor(Math.random() * 1000) + 1000 : Math.floor(Math.random() * 500) + 10,
      commentsCount: comments.length,
      comments: comments,
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
  { id: 2, type: 'like', user: { name: 'seoul_snap', avatar: 'https://i.pravatar.cc/150?u=seoul_snap' }, content: '님이 회원님의 사진을 좋아합니다.', time: '4시간', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=100&q=80' }
];