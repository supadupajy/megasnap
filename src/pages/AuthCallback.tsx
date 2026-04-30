import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('이메일 인증을 처리하고 있습니다...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // URL 해시에서 토큰 파라미터 파싱 (Supabase가 #access_token=...&type=signup 형태로 전달)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        // 쿼리 파라미터도 확인 (PKCE flow)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          // PKCE flow: code를 세션으로 교환
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus('success');
          setMessage('이메일 인증이 완료되었습니다! 잠시 후 이동합니다...');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        } else if (accessToken && refreshToken) {
          // Implicit flow: 토큰으로 세션 설정
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          setStatus('success');
          setMessage(
            type === 'signup'
              ? '회원가입이 완료되었습니다! 잠시 후 이동합니다...'
              : '이메일 인증이 완료되었습니다! 잠시 후 이동합니다...'
          );
          setTimeout(() => navigate('/', { replace: true }), 2000);
        } else {
          // 이미 세션이 있는 경우 (onAuthStateChange가 처리)
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setStatus('success');
            setMessage('이미 로그인되어 있습니다. 잠시 후 이동합니다...');
            setTimeout(() => navigate('/', { replace: true }), 1500);
          } else {
            throw new Error('인증 정보를 찾을 수 없습니다.');
          }
        }
      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setStatus('error');
        setMessage(err.message || '인증 처리 중 오류가 발생했습니다.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-20 h-20 bg-indigo-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-indigo-100">
        <span className="text-white text-3xl font-black italic">C</span>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        {status === 'loading' && (
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-10 h-10 text-green-500" />
        )}
        {status === 'error' && (
          <XCircle className="w-10 h-10 text-red-500" />
        )}

        <p className="text-base font-bold text-gray-700">{message}</p>

        {status === 'error' && (
          <p className="text-sm text-gray-400">잠시 후 로그인 페이지로 이동합니다...</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
