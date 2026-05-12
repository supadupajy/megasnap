import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

/**
 * 안드로이드 Chrome/WebView에서 <video>가 첫 프레임을 그리기 전에
 * 기본 재생 버튼 오버레이(큰 동그라미)가 잠깐 깜빡이는 문제를 방지하기 위해
 * `playing` 이벤트가 발생할 때까지 video 요소를 시각적으로 숨겨둔다.
 */
const VideoPlayer = ({ src, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handlePlaying = () => setIsReady(true);
    el.addEventListener('playing', handlePlaying);

    // 일부 환경에서 autoplay가 지연될 수 있어 수동 play() 호출
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // autoplay 정책으로 실패해도 무음/playsInline이므로 대부분 통과됨
      });
    }

    return () => {
      el.removeEventListener('playing', handlePlaying);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className ?? 'w-full h-full object-cover'}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      style={{
        opacity: isReady ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    />
  );
};

export default VideoPlayer;
