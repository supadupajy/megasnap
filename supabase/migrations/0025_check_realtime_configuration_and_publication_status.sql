-- 현재 설정된 발행물(Publication) 확인
SELECT * FROM pg_publication;

-- 'supabase_realtime' 발행물에 포함된 테이블 확인
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- posts 테이블의 설정 확인
SELECT relname, relreplident FROM pg_class WHERE relname = 'posts';
