import { Post, User, Comment } from '@/types';

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

// 카테고리별 이미지 풀 (생략 없이 유지)
const ACCIDENT_IMAGES = ["1597328290883-50c5787b7c7e", "1580273916550-e323be2ae537", "1566241440091-ec10df8db2e1", "1494976388531-d1058494cdd8", "1516733725897-1aa73b87c8e8", "1549317661-bd32c8ce0db2", "1574610758891-5b809b6e6e2e", "1506015391300-4802dc74de2e", "1518527989017-5baca7a58d3c", "1599412227383-b7d4751c8765", "1578496479914-7ef3b0193be3", "1590102426319-c7526718cd70", "1517055727180-d1a9761c546a", "1503376780353-7e6692767b70", "1541899481282-d53bffe3c35d", "1450101499163-c8848c66ca85", "1506719040632-7d588830c6a6", "1515569067071-ec3b51335dd0", "1533106497176-45ae19e68ba2", "1504215636907-fe1e63f29066"].map(id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`);
const AD_FOOD_IMAGES = ["1504674900247-0877df9cc836", "1567620905732-2d1ec7bb7445", "1565299624946-b28f40a0ae38", "1482049016688-2d3e1b311543", "1484723088339-0b2833a2595d", "1540189549336-e6e99c3679fe", "1476514525535-07fb3b4ae5f1", "1473093226795-af9932fe5855", "1512621776951-a57141f2eefd", "1467003909585-2f8a72700288", "1555939594-58d7cb561ad1", "1565958011703-44f9829ba187", "1493770348161-369560ae357d", "1504754524776-8f4f37790ca0", "1498837167922-ddd27525d352", "1513104890138-7c749659a591", "1432139555190-58524dae6a55", "1546069901-ba9599a7e63c", "1565299507177-b0ac66763828", "1567306301408-9b74779a11af"].map(id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`);
const ANIMAL_IMAGES = ["1517841905240-472988babdf9", "1514888286974-6c03e2ca1dba", "1543466835-00a7907e9de1", "1537151608828-ea2b11777ee8", "1583511655857-d19b40a7a54e", "1474511320721-9a53616e108a", "1530281700549-e82e7bf110d6", "1552053831-71594a27632d", "1518791841217-8f162f1e1131", "1548199973-03cce0bbc87b", "1561037404-61cd46aa615b", "1516734212186-a967f81ad0d7", "1533738363-b7f9aef128ce", "1519052537078-e6302a4968d4", "1507146426996-ef05306b995a", "1535268647677-300dbf3d78d1", "1544568100-847a948585b9", "1425082661705-1834bfd09dca", "1513245543132-31f507417b26", "1516222338250-863216ce01ea"].map(id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`);
const PLACE_IMAGES = ["1501785888041-af3ef285b470", "1470071459604-3b5ec3a7fe05", "1441974231531-c6227db76b6e", "1500673922987-e212871fec22", "1464822759023-fed622ff2c3b", "1472214103451-9374bd1c798e", "1469474968028-56623f02e42e", "1447752875215-b2761acb3c5d", "1433086966358-54859d0ed716", "1501854140801-50d01698950b", "1426604966848-d7adac402bff", "1418065460487-3e41a6c84dc5", "1505144808419-1957a94ca61e", "1475924156734-496f6acc671e", "1465146344425-f00d5f5c8f07", "1433838552652-f9a46b332c40", "1506744038136-46273834b3fb", "1470770841072-f978cf4d019e", "1511884642898-4c92249e20b6", "1434725039720-aaad6dd32dfe"].map(id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`);
const GENERAL_POOL = ["1493246507139-91e8fad9978e", "1500382017468-9049fed747ef", "1475113548554-5a36f1f523d6", "1518173946687-a4c8892bbd9f", "1502082553048-f009c37129b9", "1439853949127-fa647821eba0", "1508739773434-c26b3d09e071", "1414235077428-338989a2e8c0", "1490730141103-6cac27aaab94", "1519681393784-d120267933ba", "1536431311719-398b6704d4cc", "1501183638710-841dd1904471", "1506260408121-e353d10b87c7", "1431794062232-2a99a5441867", "1445262102387-5fbb30a5e59d", "1472396961693-142e6e269027", "1510784722466-f2aa9c52fed6", "1446776811953-b23d57bd21aa", "1501854140801-50d01698950b", "1469474968028-56623f02e42e"].map(id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`);

export const GIF_POOL = ["https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f", "https://images.unsplash.com/photo-1502082553048-f009c37129b9", "https://images.unsplash.com/photo-1439853949127-fa647821eba0", "https://images.unsplash.com/photo-1508739773434-c26b3d09e071", "https://images.unsplash.com/photo-1414235077428-338989a2e8c0", "https://images.unsplash.com/photo-1490730141103-6cac27aaab94", "https://images.unsplash.com/photo-1506744038136-46273834b3fb", "https://images.unsplash.com/photo-1519681393784-d120267933ba", "https://images.unsplash.com/photo-1536431311719-398b6704d4cc", "https://images.unsplash.com/photo-1501183638710-841dd1904471", "https://images.unsplash.com/photo-1470770841072-f978cf4d019e", "https://images.unsplash.com/photo-1506260408121-e353d10b87c7", "https://images.unsplash.com/photo-1511884642898-4c92249e20b6", "https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe", "https://images.unsplash.com/photo-1470252649358-969e6c24309c", "https://images.unsplash.com/photo-1431794062232-2a99a5441867", "https://images.unsplash.com/photo-1445262102387-5fbb30a5e59d", "https://images.unsplash.com/photo-1472396961693-142e6e269027", "https://images.unsplash.com/photo-1493246507139-91e8fad9978e", "https://images.unsplash.com/photo-1500382017468-9049fed747ef", "https://images.unsplash.com/photo-1475113548554-5a36f1f523d6"].map(url => `${url}?auto=format&fit=crop&w=800&q=80`);

const COMMENT_TEXTS = ["와 여기 진짜 가보고 싶었는데! 정보 감사합니다.", "날씨 좋을 때 가면 최고죠 ㅎㅎ", "주차 공간은 넉넉한가요?", "사진 필터 어떤 거 쓰셨나요? 너무 예뻐요!", "대박... 분위기 미쳤다"];
const COMMENT_USERS = ["travel_maker", "seoul_snap", "explorer_kim", "nature_lover", "daily_life"];

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

const AD_FOOD_CONTENT = ["배고플 땐 역시 배달의민족! 지금 주문하면 첫 주문 1만원 할인 🍔", "오늘 저녁은 육즙 가득한 프리미엄 스테이크 어떠세요? 🥩"];
const CONTENT_POOL = ["오늘 날씨가 너무 좋아서 산책 나왔어요! ☀️", "여기 분위기 진짜 대박... 꼭 와보세요! ✨", "맛있는 점심 먹고 힐링 중입니다 🍱", "주말 여행지로 강력 추천합니다! 🚗", "야경이 정말 아름다운 곳이에요 🌙"];
const LOCATIONS = ['서울 성수동', '제주 애월', '부산 해운대', '강릉 안목해변', '경주 황리단길'];

export const YOUTUBE_LINKS = [
  "https://www.youtube.com/watch?v=9bZkp7q19f0", "https://www.youtube.com/watch?v=kJQP7kiw5Fk", "https://www.youtube.com/watch?v=JGwWNGJdvx8", "https://www.youtube.com/watch?v=OPf0YbXqDm0", "https://www.youtube.com/watch?v=hT_nvWreIhg", "https://www.youtube.com/watch?v=nfWlot6h_JM", "https://www.youtube.com/watch?v=kffacxfA7G4", "https://www.youtube.com/watch?v=CevxZvSJLk8", "https://www.youtube.com/watch?v=09R8_2nJtjg", "https://www.youtube.com/watch?v=YQHsXMglC9A", "https://www.youtube.com/watch?v=2vjPBrBU-TM", "https://www.youtube.com/watch?v=7wtfhZwyrcc", "https://www.youtube.com/watch?v=YykjpeuMNEk", "https://www.youtube.com/watch?v=u31qwQUeGuM", "https://www.youtube.com/watch?v=TUVcZfQe-Kw", "https://www.youtube.com/watch?v=DyDfgMOUjCI", "https://www.youtube.com/watch?v=RlPNh_PB6Ww", "https://www.youtube.com/watch?v=fRh_vgS2dFE"
];

export const createMockUser = (id: string, randomFn: () => number = Math.random, forceInfluencer: boolean = false): User => {
  const finalId = id === 'me' ? 'Dyad_Explorer' : id;
  let nickname = `Explorer_${finalId}`;
  if (id === 'me') nickname = 'Dyad_Explorer';

  let followers = Math.floor(randomFn() * 5000) + 100;
  
  if (forceInfluencer) {
    const tierRoll = randomFn();
    if (tierRoll > 0.8) followers = Math.floor(randomFn() * 5000000) + 10000000; // Diamond
    else if (tierRoll > 0.5) followers = Math.floor(randomFn() * 4000000) + 1000000; // Gold
    else followers = Math.floor(randomFn() * 900000) + 100000; // Silver
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

export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number = 15, 
  specificUserId?: string,
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
): Post[] => {
  const randomFn = specificUserId ? seededRandom(specificUserId) : Math.random;

  // 그리드 기반 분산 배치를 위한 설정
  const rows = Math.ceil(Math.sqrt(count));
  const cols = Math.ceil(count / rows);

  return Array.from({ length: count }).map((_, i) => {
    const id = specificUserId ? `${specificUserId}_post_${i}` : Math.random().toString(36).substr(2, 9);
    
    const typeRoll = randomFn();
    let isInfluencer = false;
    let isPopular = false;
    let isAd = false;

    if (!specificUserId) {
      if (typeRoll < 0.03) isInfluencer = true; // 3% 확률로 인플루언서
      else if (typeRoll < 0.06) isPopular = true; // 3% 확률로 인기 포스팅
      else if (typeRoll < 0.11) isAd = true; // 5% 확률로 광고
    }

    const isGif = !isAd && randomFn() > 0.85; 
    const hasYoutube = !isAd && !isGif && randomFn() > 0.7; 
    
    let lat, lng;
    if (bounds) {
      // 그리드 내에서 랜덤 위치 선정 (전체적으로 고르게 분포)
      const rowIdx = Math.floor(i / cols);
      const colIdx = i % cols;
      const latStep = (bounds.ne.lat - bounds.sw.lat) / rows;
      const lngStep = (bounds.ne.lng - bounds.sw.lng) / cols;
      
      lat = bounds.sw.lat + (rowIdx * latStep) + (randomFn() * latStep * 0.8) + (latStep * 0.1);
      lng = bounds.sw.lng + (colIdx * lngStep) + (randomFn() * lngStep * 0.8) + (lngStep * 0.1);
    } else {
      // 영역 정보가 없을 경우 기존 방식 유지하되 범위를 넓힘
      lat = centerLat + (randomFn() - 0.5) * 0.1;
      lng = centerLng + (randomFn() - 0.5) * 0.1;
    }
    
    let content = CONTENT_POOL[Math.floor(randomFn() * CONTENT_POOL.length)] || "멋진 장소입니다! ✨";
    let category: 'food' | 'accident' | 'place' | 'animal' | 'none' = 'none';
    let images: string[] = [];
    let youtubeUrl = hasYoutube ? YOUTUBE_LINKS[Math.floor(randomFn() * YOUTUBE_LINKS.length)] : undefined;

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

    let finalImage = images[0];
    const randomCount = Math.floor(randomFn() * 16) + 10;
    const comments = generateRandomComments(randomCount, randomFn);
    
    const user = specificUserId 
      ? createMockUser(specificUserId, randomFn) 
      : createMockUser(isAd ? "sponsored" : id, randomFn, isInfluencer);

    const likes = (isPopular || isInfluencer) 
      ? Math.floor(randomFn() * 3000) + 1500 
      : Math.floor(randomFn() * 500) + 10;

    let borderType: 'popular' | 'silver' | 'gold' | 'diamond' | 'none' = 'none';
    if (isInfluencer && user.followers) {
      if (user.followers >= 10000000) borderType = 'diamond';
      else if (user.followers >= 1000000) borderType = 'gold';
      else if (user.followers >= 100000) borderType = 'silver';
    } else if (isPopular || likes >= 1500) {
      borderType = 'popular';
    }

    const createdAt = new Date(Date.now() - randomFn() * 48 * 3600000);

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
      image: finalImage,
      images,
      adImageIndex: 1,
      isLiked: randomFn() > 0.5,
      createdAt,
      borderType,
      youtubeUrl
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