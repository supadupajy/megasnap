-- 1. roles 테이블 생성 (사용자 권한 관리)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 활성화
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정: 누구나 읽을 수 있지만 본인만 확인 가능 (혹은 관리자만)
CREATE POLICY "Enable read access for all users" ON public.user_roles FOR SELECT USING (true);

-- 4. 특정 이메일을 가진 사용자의 ID를 찾아 관리자 권한 부여
-- 이메일로 ID를 찾는 것은 auth.users 테이블을 참조해야 하므로 SECURITY DEFINER 함수를 활용하거나 직접 매핑합니다.
-- 여기서는 수동으로 이메일 기반 매핑 쿼리를 실행합니다.
INSERT INTO public.user_roles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email IN ('supadupajy@gmail.com', 'supadupajy@naver.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
