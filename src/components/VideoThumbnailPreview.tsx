import { useEffect, useRef, useState } from 'react';

interface VideoThumbnailPreviewProps {
  src: string;
  className?: string;
  /** 미리보기로 보여줄 시작 시간(초). 기본 0.5초 */
  startTime?: number;
}

/**
 * 자동재생하지 않는 영상 썸네일(첫 프레임 미리보기) 용도.
 * 안드로이드 Chrome/WebView에서 <video>가 첫 프레임을 그리기 전에
 * 큰 재생버튼/회색 placeholder가 잠깐 깜빡이는 문제를 방지하기 위해
 * `loadeddata` 이벤트가 발생할 때까지 video를 opacity 0으로 숨겨둔다.
 */
const VideoThumbnailPreview = ({
  src,
  className,
  startTime = 0.5,
}: VideoThumbnailPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(false);
  }, [src]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const handleLoaded = () => setIsReady(true);
    el.addEventListener('loadeddata', handleLoaded);
    return () => {
      el.removeEventListener('loadeddata', handleLoaded);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={`${src}#t=${startTime}`}
      className={className}
      muted
      playsInline
      preload="metadata"
      style={{
        opacity: isReady ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    />
  );
};

export default VideoThumbnailPreview;
