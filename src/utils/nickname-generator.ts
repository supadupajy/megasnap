import { supabase } from "@/integrations/supabase/client";

const ADJECTIVES = [
  "빠른", "느린", "용감한", "조용한", "밝은", "어두운", "따뜻한", "차가운",
  "귀여운", "멋진", "신비한", "활발한", "행복한", "슬픈", "강한", "약한",
  "날쌘", "둔한", "영리한", "순수한", "화려한", "소박한", "당찬", "수줍은",
  "재빠른", "느긋한", "씩씩한", "나른한", "반짝이는", "고요한", "열정적인",
  "차분한", "엉뚱한", "진지한", "유쾌한", "우아한", "거친", "부드러운",
  "날카로운", "둥근", "뾰족한", "넓은", "좁은", "깊은", "얕은", "높은",
  "낮은", "무거운", "가벼운", "투명한", "불투명한", "빛나는", "어슴푸레한",
];

const NOUNS = [
  "고양이", "강아지", "토끼", "여우", "늑대", "곰", "사자", "호랑이",
  "판다", "코알라", "펭귄", "독수리", "참새", "까마귀", "부엉이", "앵무새",
  "돌고래", "상어", "고래", "문어", "오징어", "게", "새우", "불가사리",
  "장미", "튤립", "해바라기", "민들레", "벚꽃", "국화", "라벤더", "백합",
  "사과", "딸기", "포도", "수박", "복숭아", "망고", "키위", "레몬",
  "구름", "별", "달", "태양", "바람", "비", "눈", "번개",
  "산", "강", "바다", "숲", "들판", "사막", "섬", "폭포",
  "탐험가", "여행자", "모험가", "관찰자", "수호자", "방랑자", "개척자",
];

function generateCandidate(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 1000; // 1000~9999
  return `${adj}${noun}${num}`;
}

/**
 * DB에서 중복 체크 후 유일한 랜덤 닉네임을 반환합니다.
 * 최대 10회 시도하며, 모두 실패하면 UUID 기반 닉네임을 반환합니다.
 */
export async function generateUniqueNickname(): Promise<string> {
  const MAX_ATTEMPTS = 10;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = generateCandidate();

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", candidate)
      .maybeSingle();

    if (error) {
      console.error("[nickname-generator] DB 중복 체크 오류:", error);
      // 오류 시에도 계속 시도
      continue;
    }

    if (!data) {
      // 중복 없음 → 사용 가능
      return candidate;
    }
  }

  // 10회 모두 실패 시 UUID 기반 폴백
  const fallback = `탐험가${Date.now().toString(36).toUpperCase()}`;
  return fallback;
}
