import { useEffect, useRef, useState } from 'react';
import { useVideoMuted } from '@/hooks/use-video-muted';
import { cn } from '@/lib/utils';
import VideoOverlayControls from './VideoOverlayControls';

const TRANSPARENT_POSTER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

interface VideoPlayerProps {
  src: string;
  className?: string;
  posterUrl?: string;
}

/**
 * 단일 영상 뷰(PostDetail 등)에서 사용하는 자동재생 영상 플레이어.
 * - 자체적으로 autoPlay 호출, 첫 프레임 깜빡임 방지(opacity)
 * - 댓글 다이얼로그가 열려 있는 동안 자동 일시정지/재개
 *
 * 음소거 토글/타임라인/스크럽 등 공통 컨트롤은 VideoOverlayControls가 처리한다.
 */
const VideoPlayer = ({ src, className, posterUrl }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  // 외부 오버레이(댓글/태그 검색)가 떠 있는 동안 재생을 잠시 멈춰두기 위한 ref
  const wasPlayingBeforeOverlayRef = useRef(false);

  // 전역 음소거 상태 (Reels/PostItemVideo와 공유됨)
  const [muted, setMuted] = useVideoMuted();

  useEffect(() => {
    setIsReady(false);
    const el = videoRef.current;
    if (!el) return;

    const handleReady = () => setIsReady(true);
    el.addEventListener('loadeddata', handleReady);
    el.addEventListener('canplay', handleReady);
    el.addEventListener('playing', handleReady);

    if (el.readyState >= 2) handleReady();

    // 일부 환경에서 autoplay가 지연될 수 있어 수동 play() 호출
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // autoplay 정책으로 실패해도 무음/playsInline이므로 대부분 통과됨
      });
    }

    return () => {
      el.removeEventListener('loadeddata', handleReady);
      el.removeEventListener('canplay', handleReady);
      el.removeEventListener('playing', handleReady);
    };
  }, [src]);

  // 음소거 해제 시 재생 시도 (user gesture 직후이므로 정책 통과)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!muted) {
      v.play().catch(() => {
        // 정책상 실패 시 다시 muted로 폴백
        v.muted = true;
        setMuted(true);
      });
    }
  }, [muted, src, setMuted]);

  // 댓글 다이얼로그가 열려있는 동안 영상 일시정지, 닫히면 재개
  useEffect(() => {
    let commentsOpen = !!(window as any).__commentsDialogOpen;

    const apply = () => {
      const v = videoRef.current;
      if (!v) return;
      if (commentsOpen) {
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

    window.addEventListener('comments-dialog-visibility', handleComments);
    apply();

    return () => {
      window.removeEventListener('comments-dialog-visibility', handleComments);
    };
  }, []);

  // 스크럽 시작/끝에 따라 비디오 재생 상태 보존
  const wasPlayingBeforeScrubRef = useRef(false);
  const handleScrubStart = () => {
    const v = videoRef.current;
    if (!v) return;
    wasPlayingBeforeScrubRef.current = !v.paused;
    v.pause();
  };
  const handleScrubEnd = () => {
    const v = videoRef.current;
    if (!v) return;
    if (wasPlayingBeforeScrubRef.current) {
      v.play().catch(() => {});
    }
  };

  return (
    <>
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className={cn(className ?? 'w-full h-full object-cover', 'absolute inset-0')}
          draggable={false}
          style={{
            opacity: isReady ? 0 : 1,
            transition: 'opacity 180ms ease-out',
          }}
        />
      )}

      <video
        ref={videoRef}
        src={src}
        className={cn(className ?? 'w-full h-full object-cover', 'relative z-[1] video-hq')}
        poster={posterUrl || TRANSPARENT_POSTER}
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="auto"
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 180ms ease-out',
        }}
      />

      {/* 공통 오버레이 컨트롤: 음소거 토글 + 타임라인(스크럽 + rAF 스무스 + 시간 표시) */}
      <VideoOverlayControls
        videoRef={videoRef}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
    </>
  );
};

export default VideoPlayer;
