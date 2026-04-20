type Bounds = {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
};

export type OfflineRegion = {
  key: string;
  shortName: string;
  displayPrefix: string;
  lat: number;
  lng: number;
  density?: number;
  bounds: Bounds;
  districts: string[];
};

export const OFFLINE_REGION_CITIES: OfflineRegion[] = [
  {
    key: 'seoul',
    shortName: '서울',
    displayPrefix: '서울시',
    lat: 37.5665,
    lng: 126.978,
    density: 700,
    bounds: { sw: { lat: 37.42, lng: 126.75 }, ne: { lat: 37.72, lng: 127.2 } },
    districts: [
      '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구',
      '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구',
      '관악구', '서초구', '강남구', '송파구', '강동구',
    ],
  },
  {
    key: 'busan',
    shortName: '부산',
    displayPrefix: '부산시',
    lat: 35.1796,
    lng: 129.0756,
    density: 600,
    bounds: { sw: { lat: 35.0485, lng: 128.8905 }, ne: { lat: 35.3156, lng: 129.2333 } },
    districts: [
      '중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구',
      '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군',
    ],
  },
  {
    key: 'incheon',
    shortName: '인천',
    displayPrefix: '인천시',
    lat: 37.4563,
    lng: 126.7052,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 37.3689, lng: 126.5841 }, ne: { lat: 37.5856, lng: 126.7712 } },
    districts: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  },
  {
    key: 'daegu',
    shortName: '대구',
    displayPrefix: '대구시',
    lat: 35.8714,
    lng: 128.6014,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 35.7756, lng: 128.4523 }, ne: { lat: 35.9542, lng: 128.7234 } },
    districts: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  },
  {
    key: 'daejeon',
    shortName: '대전',
    displayPrefix: '대전시',
    lat: 36.3504,
    lng: 127.3845,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 36.2654, lng: 127.2845 }, ne: { lat: 36.4856, lng: 127.4856 } },
    districts: ['동구', '중구', '서구', '유성구', '대덕구'],
  },
  {
    key: 'gwangju',
    shortName: '광주',
    displayPrefix: '광주시',
    lat: 35.1595,
    lng: 126.8526,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 35.0856, lng: 126.7542 }, ne: { lat: 35.2542, lng: 126.9542 } },
    districts: ['동구', '서구', '남구', '북구', '광산구'],
  },
  {
    key: 'ulsan',
    shortName: '울산',
    displayPrefix: '울산시',
    lat: 35.5384,
    lng: 129.3114,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 35.4542, lng: 129.1542 }, ne: { lat: 35.6542, lng: 129.4542 } },
    districts: ['중구', '남구', '동구', '북구', '울주군'],
  },
  {
    key: 'suwon',
    shortName: '수원',
    displayPrefix: '경기도 수원시',
    lat: 37.2636,
    lng: 127.0286,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 37.2142, lng: 126.9542 }, ne: { lat: 37.3542, lng: 127.1542 } },
    districts: ['장안구', '권선구', '팔달구', '영통구'],
  },
  {
    key: 'jeju',
    shortName: '제주',
    displayPrefix: '제주특별자치도',
    lat: 33.4996,
    lng: 126.5312,
    density: DEFAULT_REGION_DENSITY,
    bounds: { sw: { lat: 33.2142, lng: 126.2142 }, ne: { lat: 33.5542, lng: 126.9142 } },
    districts: ['제주시', '서귀포시'],
  },
];

const GENERIC_LOCATION_NAMES = new Set([
  '대한민국',
  '알 수 없는 장소',
  '서울',
  '부산',
  '인천',
  '대구',
  '대전',
  '광주',
  '울산',
  '수원',
  '제주',
]);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash);
};

const isInsideBounds = (lat: number, lng: number, bounds: Bounds) => {
  return lat >= bounds.sw.lat && lat <= bounds.ne.lat && lng >= bounds.sw.lng && lng <= bounds.ne.lng;
};

const getDistanceScore = (lat: number, lng: number, region: OfflineRegion) => {
  return Math.hypot(region.lat - lat, region.lng - lng);
};

const getRegionByCoords = (lat: number, lng: number) => {
  const containingRegion = OFFLINE_REGION_CITIES.find((region) => isInsideBounds(lat, lng, region.bounds));
  if (containingRegion) return containingRegion;

  return OFFLINE_REGION_CITIES.reduce((closest, region) => {
    if (!closest) return region;
    return getDistanceScore(lat, lng, region) < getDistanceScore(lat, lng, closest) ? region : closest;
  }, OFFLINE_REGION_CITIES[0]);
};

const getDistrictIndex = (region: OfflineRegion, lat: number, lng: number) => {
  if (region.districts.length === 1) return 0;

  const latRatio = clamp((lat - region.bounds.sw.lat) / (region.bounds.ne.lat - region.bounds.sw.lat), 0, 0.999999);
  const lngRatio = clamp((lng - region.bounds.sw.lng) / (region.bounds.ne.lng - region.bounds.sw.lng), 0, 0.999999);
  const spatialScore = ((1 - latRatio) * 0.53) + (lngRatio * 0.47);
  const baseIndex = Math.floor(spatialScore * region.districts.length);
  const jitter = stableHash(`${region.key}:${lat.toFixed(4)}:${lng.toFixed(4)}`) % Math.min(3, region.districts.length);

  return (baseIndex + jitter) % region.districts.length;
};

const formatLocation = (region: OfflineRegion, district: string) => {
  if (region.key === 'jeju') {
    return `${region.displayPrefix} ${district}`;
  }

  return `${region.displayPrefix} ${district}`;
};

export const resolveOfflineLocationName = (lat: number, lng: number) => {
  const region = getRegionByCoords(lat, lng);
  const district = region.districts[getDistrictIndex(region, lat, lng)] || region.shortName;

  return formatLocation(region, district);
};

export const shouldEnrichLocationName = (locationName?: string | null) => {
  if (!locationName) return true;

  const trimmed = locationName.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('좌표:')) return true;
  if (GENERIC_LOCATION_NAMES.has(trimmed)) return true;

  return !trimmed.includes(' ');
};
