-- 기존 정책 제거
DROP POLICY IF EXISTS "Admin bulk delete" ON public.posts;

-- 관리자 역할(admin)을 가진 사용자만 모든 포스팅을 삭제할 수 있도록 정책 재설정
CREATE POLICY "Admin bulk delete" ON public.posts
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
  )
);
