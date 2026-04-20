// 1. 도시 설정 및 데이터
export const MAJOR_CITIES = [
  { name: "서울", lat: 37.5665, lng: 126.9780, density: 1500, bounds: { sw: { lat: 37.4200, lng: 126.7500 }, ne: { lat: 37.7200, lng: 127.2000 } } },
  { name: "부산", lat: 35.1796, lng: 129.0756, density: 800, bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } } },
  { name: "인천", lat: 37.4563, lng: 126.7052, density: 600, bounds: { sw: { lat: 37.3500, lng: 126.4000 }, ne: { lat: 37.6500, lng: 126.8500 } } },
  { name: "대구", lat: 35.8714, lng: 128.6014, density: 500, bounds: { sw: { lat: 35.7500, lng: 128.4500 }, ne: { lat: 35.9500, lng: 128.7500 } } },
  { name: "대전", lat: 36.3504, lng: 127.3845, density: 400, bounds: { sw: { lat: 36.2000, lng: 127.2500 }, ne: { lat: 36.5000, lng: 127.5000 } } },
  { name: "광주", lat: 35.1595, lng: 126.8526, density: 400, bounds: { sw: { lat: 35.0500, lng: 126.7000 }, ne: { lat: 35.2500, lng: 127.0000 } } },
  { name: "울산", lat: 35.5384, lng: 129.3114, density: 300, bounds: { sw: { lat: 35.4000, lng: 129.1500 }, ne: { lat: 35.6500, lng: 129.4500 } } },
  { name: "수원", lat: 37.2636, lng: 127.0286, density: 400, bounds: { sw: { lat: 37.2142, lng: 126.9542 }, ne: { lat: 37.3542, lng: 127.1542 } } },
  { name: "제주", lat: 33.4996, lng: 126.5312, density: 600, bounds: { sw: { lat: 33.2000, lng: 126.1500 }, ne: { lat: 33.5500, lng: 126.9500 } } }
];

// 2. 리소스 ID 리스트
export const UNSPLASH_IDS = [ /* 이전의 100개 ID 리스트를 여기에 넣으세요 */ ];
export const YOUTUBE_IDS_50 = [ /* 이전의 50개 ID 리스트를 여기에 넣으세요 */ ];
export const FOOD_UNSPLASH_IDS = ["photo-1504674900247-0877df9cc836", "photo-1493770348161-369560ae357d", "photo-1476224203421-9ac3993c4c5a"];

// 3. 텍스트 데이터
export const REALISTIC_COMMENTS = ["여기 분위기 진짜 대박이에요! 😍", "오늘 날씨랑 찰떡인 장소 발견! ✨", "인생샷 건졌습니다. 📸"];
export const AD_COMMENTS = ["[AD] 특별한 혜택을 만나보세요!", "[AD] 프리미엄 서비스를 경험하세요."];

// 4. [중요] 좌표 생성 함수 (에러 해결 포인트)
export const createMockPosts = (
  centerLat: number, 
  centerLng: number, 
  count: number, 
  radius: number = 0.1, // 기본 범위
  bounds?: { sw: { lat: number, lng: number }, ne: { lat: number, lng: number } }
) => {
  const posts = [];
  for (let i = 0; i < count; i++) {
    let lat, lng;
    if (bounds) {
      // 경계값이 있으면 그 안에서 랜덤 생성
      lat = bounds.sw.lat + Math.random() * (bounds.ne.lat - bounds.sw.lat);
      lng = bounds.sw.lng + Math.random() * (bounds.ne.lng - bounds.sw.lng);
    } else {
      // 중심점 기준 랜덤 생성
      lat = centerLat + (Math.random() - 0.5) * radius;
      lng = centerLng + (Math.random() - 0.5) * radius;
    }
    posts.push({ lat, lng });
  }
  return posts;
};

// 5. 유틸리티
export const getUnsplashUrl = (id: string, sig?: number) => {
  const baseUrl = `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=800`;
  return sig !== undefined ? `${baseUrl}&sig=${sig}` : baseUrl;
};