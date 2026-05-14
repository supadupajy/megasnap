import { showSuccess } from './toast';

// 앱 스킴 및 스토어 링크 (실제 앱 출시 시 변경 필요)
const APP_SCHEME = 'chorasnap';
const ANDROID_PACKAGE = 'com.chorasnap.chorasnap';
const IOS_APP_ID = '0000000000'; // 실제 App Store ID로 교체 필요
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
export const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;

// 프로덕션 배포 URL (VITE_APP_URL 환경변수로 설정, 없으면 현재 origin 사용)
const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, ''); // 끝 슬래시 제거
  return window.location.origin;
};

/**
 * Capacitor 네이티브 앱 내부에서 실행 중인지 감지
 * - window.Capacitor 객체가 있고 isNativePlatform()이 true이면 네이티브 앱
 */
const isNativeApp = (): boolean => {
  try {
    const cap = (window as any).Capacitor;
    return cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * 포스팅 공유 URL 생성
 * 웹 URL: https://[배포도메인]/post/[id]
 */
export const getPostShareUrl = (postId: string): string => {
  return `${getBaseUrl()}/post/${postId}`;
};

const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess('포스팅 주소가 복사되었습니다.');
  } catch {
    // clipboard API 실패 시 execCommand fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showSuccess('포스팅 주소가 복사되었습니다.');
    } catch {
      // 복사 자체가 실패한 경우 아무것도 하지 않음
    }
  }
};

/**
 * 공유하기 버튼 핸들러
 * - URL을 클립보드에 복사
 * - 토스트 메시지 표시
 */
export const handleShare = async (
  e: React.MouseEvent,
  postId: string
): Promise<void> => {
  e.stopPropagation();

  const shareUrl = getPostShareUrl(postId);

  // Web Share API 지원 시 네이티브 공유 시트 사용 (모바일)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'TocaToca 포스팅',
        url: shareUrl,
      });
      showSuccess('포스팅 주소가 복사되었습니다.');
    } catch (err: any) {
      // AbortError: 사용자가 공유 시트를 닫은 경우 → 아무것도 하지 않음
      if (err?.name === 'AbortError') return;
      // 그 외 오류는 클립보드 복사로 fallback
      await copyToClipboard(shareUrl);
    }
    return;
  }

  // 클립보드 복사 (데스크탑 / Web Share 미지원)
  await copyToClipboard(shareUrl);
};

/**
 * 외부 브라우저에서 /post/:id 접근 시 딥링크 처리
 * - 네이티브 앱 내부에서는 실행하지 않음 (이미 앱 안에 있으므로)
 * - 모바일 브라우저에서만 앱 실행 시도
 * - 앱이 없으면 스토어로 이동
 *
 * ⚠️ 이 함수는 PostDeepLinkLanding 컴포넌트에서 직접 처리하므로
 *    PostDetail에서는 더 이상 호출하지 않습니다.
 */
export const handleDeepLink = (postId: string): void => {
  // 네이티브 앱 내부에서는 딥링크 처리 불필요
  if (isNativeApp()) return;

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!isAndroid && !isIOS) return; // 데스크탑은 그냥 웹으로 표시

  const deepLinkUrl = `${APP_SCHEME}://post/${postId}`;
  const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;

  // 앱 실행 시도
  const start = Date.now();
  window.location.href = deepLinkUrl;

  // 앱이 없으면 페이지가 그대로 남아있으므로 타이머로 스토어 이동
  const timer = setTimeout(() => {
    if (Date.now() - start < 2000) {
      window.location.href = storeUrl;
    }
  }, 1500);

  // 페이지가 숨겨지면(앱이 열리면) 타이머 취소
  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
};
