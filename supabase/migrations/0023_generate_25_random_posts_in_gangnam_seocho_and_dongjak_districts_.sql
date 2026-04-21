DO $$
DECLARE
    i INTEGER;
    districts TEXT[] := ARRAY['서울시 강남구', '서울시 서초구', '서울시 동작구'];
    district_centers_lat DOUBLE PRECISION[] := ARRAY[37.4979, 37.4837, 37.5051];
    district_centers_lng DOUBLE PRECISION[] := ARRAY[127.0276, 127.0324, 126.9450];
    nicknames TEXT[] := ARRAY['맛집탐방가', '동네한바퀴', '주말여행', '일상기록', '사진가', '미식가', '탐험가', '트래블러'];
    contents TEXT[] := ARRAY['여기는 정말 분위기가 좋네요!', '오늘 날씨가 너무 완벽합니다.', '드디어 와본 핫플레이스!', '주말 나들이하기 딱 좋은 곳이에요.', '추천받아 왔는데 만족스럽습니다.', '동네 주민들만 아는 숨은 장소!', '가족들과 함께 오기 좋아요.', '혼자 산책하기 좋은 코스입니다.'];
    categories TEXT[] := ARRAY['food', 'place', 'animal', 'none'];
    target_dist_idx INTEGER;
    lat DOUBLE PRECISION;
    lng DOUBLE PRECISION;
    random_user_id TEXT;
BEGIN
    FOR i IN 1..25 LOOP
        target_dist_idx := (floor(random() * 3) + 1)::integer;
        -- 중심점에서 약 2km 이내 랜덤 분포 (약 0.018도 차이)
        lat := district_centers_lat[target_dist_idx] + (random() - 0.5) * 0.035;
        lng := district_centers_lng[target_dist_idx] + (random() - 0.5) * 0.035;
        random_user_id := gen_random_uuid()::text;

        INSERT INTO public.posts (
            content,
            location_name,
            latitude,
            longitude,
            image_url,
            user_id,
            user_name,
            user_avatar,
            likes,
            category,
            created_at
        ) VALUES (
            contents[(floor(random() * array_length(contents, 1)) + 1)::integer],
            districts[target_dist_idx],
            lat,
            lng,
            'https://source.unsplash.com/random/800x600?sig=' || i || '&city,korea',
            random_user_id,
            nicknames[(floor(random() * array_length(nicknames, 1)) + 1)::integer] || floor(random() * 99),
            'https://i.pravatar.cc/150?u=' || random_user_id,
            floor(random() * 500)::bigint,
            categories[(floor(random() * array_length(categories, 1)) + 1)::integer],
            now() - (random() * interval '7 days')
        );
    END LOOP;
END $$;