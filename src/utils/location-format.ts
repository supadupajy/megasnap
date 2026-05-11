export const normalizeRegionName = (regionName: string) => {
  const aliases: Record<string, string> = {
    서울: '서울시',
    부산: '부산시',
    인천: '인천시',
    대구: '대구시',
    대전: '대전시',
    광주: '광주시',
    울산: '울산시',
    세종특별자치시: '세종시',
    강원특별자치도: '강원도',
  };

  return aliases[regionName] || regionName;
};

export const normalizeLocationName = (locationName: string) => {
  return locationName.split('강원특별자치도').join('강원도');
};

export const formatAdministrativeAddress = (
  city?: string,
  district?: string,
  dong?: string
) => {
  return [normalizeRegionName(city || ''), district || '', dong || '']
    .filter(Boolean)
    .join(' ');
};
