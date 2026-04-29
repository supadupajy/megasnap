import { showSuccess } from './toast';

// 앱 스킴 및 스토어 링크 (실제 앱 출시 시 변경 필요)
const APP_SCHEME = 'chorasnap';
const ANDROID_PACKAGE = 'com.chorasnap.app';
const IOS_APP_ID = '0000000000'; // 실제 App Store ID로 교체 필요
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;

/**
 * 포스팅 공유 URL 생성
 * 웹 URL: https://[host]/post/[id]
 */
export const getPostShareUrl = (postId: string): string => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/post/${postId}`;
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

  // 클립보드 복사 (Web Share API 사용하지 않고 항상 직접 복사)
  await copyToClipboard(shareUrl);
};

/**
 * /post/:id 페이지 진입 시 딥링크 처리
 * - 앱 설치 여부를 감지하여 앱 실행 시도
 * - 일정 시간 내 앱이 열리지 않으면 스토어로 이동
 */
export const handleDeepLink = (postId: string): void => {
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
    // 앱이 열렸다면 페이지가 blur 되어 시간이 많이 지났을 것
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
