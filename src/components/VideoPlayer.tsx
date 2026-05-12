import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useVideoMuted } from '@/hooks/use-video-muted';
import { cn } from '@/lib/utils';

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
  // 외부 오버레이(댓글/태그 검색)가 떠 있는 동안 재생을 잠시 멈춰두기 위한 ref
  const wasPlayingBeforeOverlayRef = useRef(false);

  // 전역 음소거 상태 (Reels/PostItemVideo와 공유됨)
  const [muted, setMuted] = useVideoMuted();

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

  // 전역 muted 상태를 video 요소에 반영하고, 음소거 해제 시 재생 시도
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) {
      // 사용자가 버튼으로 토글한 직후이므로 user gesture가 살아있어 재생 허용됨
      v.play().catch(() => {
        // 정책상 실패 시 다시 muted로 폴백
        v.muted = true;
      });
    }
  }, [muted, src]);

  // 댓글 다이얼로그 / 포스트 검색 오버레이가 열려있는 동안 영상 일시정지, 닫히면 재개
  useEffect(() => {
    let commentsOpen = !!(window as any).__commentsDialogOpen;
    let searchOpen = !!(window as any).__postSearchOverlayOpen;

    const apply = () => {
      const v = videoRef.current;
      if (!v) return;
      const overlayOpen = commentsOpen || searchOpen;
      if (overlayOpen) {
        if (!v.paused) {
          wasPlayingBeforeOverlayRef.current = true;
          v.pause();
        }
      } else if (wasPlayingBeforeOverlayRef.current) {
        wasPlayingBeforeOverlayRef.current = false;
        v.play().catch(() => {});
      }
    };

    const handleComments = (e: Event) => {
      commentsOpen = !!(e as CustomEvent).detail?.open;
      apply();
    };
    const handleSearch = (e: Event) => {
      searchOpen = !!(e as CustomEvent).detail?.open;
      apply();
    };

    window.addEventListener('comments-dialog-visibility', handleComments);
    window.addEventListener('post-search-visibility', handleSearch);
    apply();

    return () => {
      window.removeEventListener('comments-dialog-visibility', handleComments);
      window.removeEventListener('post-search-visibility', handleSearch);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        className={className ?? 'w-full h-full object-cover'}
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="auto"
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 150ms ease-out',
        }}
      />
      {/* 좌상단 음소거 토글 — 영상을 눌러도 닫히므로, 사용자가 소리를 제어할 수 있도록 별도 버튼 제공 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        aria-label={muted ? '음소거 해제' : '음소거'}
        className={cn(
          'absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md',
          'flex items-center justify-center border border-white/10',
          'active:scale-95 transition-transform'
        )}
      >
        {muted ? (
          <VolumeX className="w-4 h-4 text-white" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>
    </>
  );
};

export default VideoPlayer;
