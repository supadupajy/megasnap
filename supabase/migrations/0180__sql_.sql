
CREATE OR REPLACE FUNCTION public.generate_random_nickname()
RETURNS TEXT
LANGUAGE PLPGSQL
AS $$
DECLARE
  adjectives TEXT[] := ARRAY[
    '빠른','느린','용감한','조용한','밝은','어두운','따뜻한','차가운',
    '귀여운','멋진','신비한','활발한','행복한','강한','날쌘','영리한',
    '화려한','소박한','당찬','수줍은','재빠른','느긋한','씩씩한','반짝이는',
    '고요한','열정적인','차분한','엉뚱한','진지한','유쾌한','우아한','부드러운'
  ];
  nouns TEXT[] := ARRAY[
    '고양이','강아지','토끼','여우','늑대','곰','사자','호랑이',
    '판다','코알라','펭귄','독수리','참새','부엉이','앵무새','돌고래',
    '상어','고래','문어','오징어','장미','튤립','해바라기','벚꽃',
    '사과','딸기','포도','수박','복숭아','구름','별','달',
    '탐험가','여행자','모험가','관찰자','수호자','방랑자','개척자'
  ];
  adj TEXT;
  noun TEXT;
  num INT;
  candidate TEXT;
  exists_count INT;
  attempts INT := 0;
BEGIN
  LOOP
    adj := adjectives[1 + floor(random() * array_length(adjectives, 1))::INT];
    noun := nouns[1 + floor(random() * array_length(nouns, 1))::INT];
    num := 1000 + floor(random() * 9000)::INT;
    candidate := adj || noun || num::TEXT;

    SELECT COUNT(*) INTO exists_count FROM public.profiles WHERE nickname = candidate;

    IF exists_count = 0 THEN
      RETURN candidate;
    END IF;

    attempts := attempts + 1;
    IF attempts >= 10 THEN
      -- 폴백: 탐험가 + 타임스탬프 기반
      RETURN '탐험가' || to_char(now(), 'SSMS');
    END IF;
  END LOOP;
END;
$$;
