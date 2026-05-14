import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import VideoOverlayControls from './VideoOverlayControls';

interface PostItemVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  posterImage: string;
  showPoster: boolean;
  onLoadedData: () => void;
  onImageError: React.ReactEventHandler<HTMLImageElement>;
}

/**
 * 리스트뷰용 영상 플레이어 컴포넌트.
 * - 영상 영역 탭 → 재생/일시정지 토글
 * - 일시정지 시 중앙에 큰 플레이 아이콘 오버레이
 * - poster 이미지 페이드인으로 첫 프레임 깜빡임 방지
 *
 * 음소거 토글/타임라인/스크럽 등 공통 컨트롤은 VideoOverlayControls가 처리한다.
 */
const PostItemVideo: React.FC<PostItemVideoProps> = ({
  videoRef,
  src,
  posterImage,
  showPoster,
  onLoadedData,
  onImageError,
}) => {
  // 화면에 표시할 "사용자가 직접 일시정지함" 상태.
  // - 자동 재생/스크롤/buffering/loop 전환 등으로 인한 짧은 pause는 무시한다.
  // - 사용자가 영상 영역을 탭해서 명시적으로 일시정지한 경우에만 true가 된다.
  // 이렇게 해야 영상 시작 직후나 슬라이드 전환 중에 큰 재생 아이콘이 깜빡이는
  // 플리커링이 발생하지 않는다.
  const [userPaused, setUserPaused] = useState(false);
  // 비디오의 첫 프레임이 실제로 그려졌는지(playing 이벤트 발생) 추적.
  // 첫 프레임이 그려지기 전에 video를 노출하면 브라우저가 회색 placeholder나
  // 기본 재생 아이콘을 잠깐 그려서 플리커링이 발생하므로, 그 전까지는 opacity:0으로 숨긴다.
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  // 외부 요인으로 재생이 다시 시작되면(자동 재생 등) userPaused 해제 + 첫 프레임 신호 처리
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlaying = () => {
      setUserPaused(false);
      setFirstFrameReady(true);
    };
    v.addEventListener('playing', onPlaying);
    return () => {
      v.removeEventListener('playing', onPlaying);
    };
  }, [videoRef, src]);

  // src가 바뀌면 사용자 일시정지 상태와 첫 프레임 준비 상태 초기화
  useEffect(() => {
    setUserPaused(false);
    setFirstFrameReady(false);
  }, [src]);

  // 사용자가 영상 영역을 탭한 경우에만 명시적으로 일시정지/재생을 토글.
  // 이때만 userPaused가 true가 되어 큰 플레이 아이콘 오버레이가 노출된다.
  const handleVideoTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

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
    <div className="relative h-full w-full bg-gray-200">
      <div className="absolute inset-0 bg-gray-200" aria-hidden="true" />
      <video
        ref={videoRef}
        src={src}
        // poster 속성을 명시적으로 지정하는 것이 핵심.
        // 안드로이드 WebView는 video element가 첫 프레임을 디코드하기 전에
        // 회색 배경 위에 OS 네이티브 재생 아이콘을 그리는데, poster가 지정되어 있으면
        // 그 자리에 poster 이미지를 대신 그려서 네이티브 컨트롤이 보이지 않게 한다.
        poster={posterImage}
        className="absolute inset-0 z-[1] w-full h-full object-cover bg-gray-200 post-item-video video-hq"
        loop
        playsInline
        disablePictureInPicture
        controls={false}
        // 안드로이드/iOS WebView가 추가 컨트롤(다운로드, 캐스트 등)을 그리는 것을 차단
        controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
        disableRemotePlayback={true}
        onClick={handleVideoTap}
        onLoadedData={onLoadedData}
      />

      {/* poster(썸네일) 이미지를 video 위에 항상 덮어둔다.
          - 첫 프레임이 그려지기 전까지는 완전 불투명(opacity:1)으로 video를 가린다.
          - 첫 프레임이 그려지면(firstFrameReady) opacity:0으로 부드럽게 사라진다.
          - 이렇게 하면 fade 도중에도 poster가 video를 덮은 상태이므로
            안드로이드 WebView의 회색 placeholder/네이티브 컨트롤이 노출되지 않는다.
          - showPoster prop이 명시적으로 true일 때(외부에서 강제로 poster 유지)도 표시. */}
      <img
        src={posterImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 z-10 w-full h-full object-cover bg-gray-200 pointer-events-none"
        onError={onImageError}
        style={{
          opacity: showPoster || !firstFrameReady ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      />

      {/* 일시정지 시 중앙 플레이 아이콘 오버레이
          - 사용자가 직접 탭으로 일시정지한 경우(userPaused=true)에만 노출.
          - 그리고 비디오 첫 프레임이 그려진 후(firstFrameReady)에만 노출.
          - 자동 재생/스크롤/buffering/loop 전환/로딩 중에는 절대 표시되지 않는다. */}
      {userPaused && firstFrameReady && !showPoster && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}

      {/* 공통 오버레이 컨트롤: 음소거 토글 + 타임라인(스크럽 + rAF 스무스 + 시간 표시) */}
      <VideoOverlayControls
        videoRef={videoRef}
        onScrubStart={handleScrubStart}
        onScrubEnd={handleScrubEnd}
      />
    </div>
  );
};

export default PostItemVideo;
