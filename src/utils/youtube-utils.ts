"use client";

/**
 * 유튜브 URL의 유효성을 oEmbed API를 통해 검증합니다.
 * @param url 검증할 유튜브 URL
 * @returns 재생 가능 여부 (boolean)
 */
export const verifyYoutubeUrl = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  try {
    // oEmbed API는 별도의 키 없이도 HTTP 상태 코드로 유효성을 확인할 수 있습니다.
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    
    // 200 OK: 정상 영상
    // 401 Unauthorized: 비공개 영상
    // 404 Not Found: 삭제되었거나 존재하지 않는 영상
    return response.status === 200;
  } catch (error) {
    console.error("[YouTube Verify] Error checking URL:", url, error);
    // 네트워크 오류 등의 경우 안전을 위해 false 반환
    return false;
  }
};