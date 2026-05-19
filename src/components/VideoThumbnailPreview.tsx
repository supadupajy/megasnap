import { useEffect, useRef, useState } from 'react';

interface VideoThumbnailPreviewProps {
  src: string;
  className?: string;
  startTime?: number;
}

const VideoThumbnailPreview = ({
  src,
  className,
  startTime = 0.8,
}: VideoThumbnailPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const setReady = (value: boolean) => {
    isReadyRef.current = value;
    setIsReady(value);
  };

  useEffect(() => {
    setReady(false);
  }, [src, startTime]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const show = () => {
      setReady(true);
    };

    const seekToPreviewFrame = () => {
      if (!Number.isFinite(el.duration) || el.duration <= 0.25) return;
      const target = Math.min(startTime, el.duration - 0.05);
      if (target > 0 && Math.abs(el.currentTime - target) > 0.05) {
        try {
          el.currentTime = target;
        } catch {}
      }
    };

    el.addEventListener('loadedmetadata', seekToPreviewFrame);
    el.addEventListener('loadeddata', show);
    el.addEventListener('seeked', show);
    el.addEventListener('canplay', show);

    return () => {
      el.removeEventListener('loadedmetadata', seekToPreviewFrame);
      el.removeEventListener('loadeddata', show);
      el.removeEventListener('seeked', show);
      el.removeEventListener('canplay', show);
    };
  }, [src, startTime]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <video
        ref={videoRef}
        src={src}
        className={`${className ?? ''} video-hq`.trim()}
        muted
        playsInline
        // 슬라이드 미리보기는 정지된 첫 프레임 한 장만 보여주면 충분하다.
        // 전체 영상을 다운로드할 필요가 없으므로 metadata만 받아 모바일 부담을 줄인다.
        // (대부분의 브라우저는 metadata 단계에서 이미 첫 프레임을 디코드해준다.)
        preload="metadata"
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 80ms linear',
          backgroundColor: 'transparent',
        }}
      />
    </div>
  );
};

export default VideoThumbnailPreview;
