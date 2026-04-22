-- 1. 기존 설정이 꼬였을 수 있으니 명시적으로 다시 설정
-- supabase_realtime 발행물이 없으면 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. 이미 등록되어 있을 수 있으므로, 안전하게 테이블을 다시 추가
-- (이미 존재하는 경우 무시하는 옵션이 없으므로 익명 블록 사용)
DO $$
BEGIN
    -- posts 테이블이 발행물에 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;
END $$;

-- 3. Replica Identity를 'FULL'로 강제 설정 (실시간 데이터 누락 방지 핵심)
ALTER TABLE public.posts REPLICA IDENTITY FULL;

-- 4. RLS(Row Level Security) 정책 확인
-- 만약 posts 테이블에 RLS가 걸려있는데 실시간용 정책이 없으면 안 보일 수 있음.
-- (기존에 SELECT TRUE 정책이 있는지 확인 필요하지만 일단 실행)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Enable realtime access for all') THEN
        CREATE POLICY "Enable realtime access for all" ON public.posts FOR SELECT USING (true);
    END IF;
END $$;
