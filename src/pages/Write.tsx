"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, X, ImageIcon, Utensils, Car, TreePine, PawPrint, ChevronLeft, ChevronRight, Loader2, PenLine, Check, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { cn, createVideoThumbnail, cropImageToAspectRatio } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { postDraftStore } from '@/utils/post-draft-store';
import { resolveOfflineLocationName } from '@/utils/offline-location';
import { getSeoulDistrict } from '@/utils/seoul-district-polygons';
import { useWriteStore } from '@/utils/write-store';
import { mapCache } from '@/utils/map-cache';
import { extractHashtags } from '@/utils/hashtags';
import { formatAdministrativeAddress } from '@/utils/location-format';
import { loadKakaoMapsSdk } from '@/utils/kakao-maps';

interface MediaFile {
  file: File;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
  thumbnailBlob?: Blob; // 동영상 썸네일 미리 생성해둔 Blob
  crop?: { x: number; y: number };
  zoom?: number;
  orientation?: 'landscape' | 'portrait';
}

const CATEGORIES = [
  { key: 'none', label: '없음', Icon: X },
  { key: 'food', label: '맛집', Icon: Utensils },
  { key: 'accident', label: '사고', Icon: Car },
  { key: 'place', label: '명소', Icon: TreePine },
  { key: 'animal', label: '동물', Icon: PawPrint },
] as const;

const Write = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, profile } = useAuth();

  const { content, setContent, category, setCategory, clear, mediaFiles, setMediaFiles } = useWriteStore();
  const hashtags = useMemo(() => extractHashtags(content), [content]);
  
  const [currentPage, setCurrentPage] = useState<1 | 2>(
    location.state?.location || location.state?.fromLocationSelection ? 2 : 1
  );

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  // ✅ 이미지 로드 완료 여부를 state로 관리
  const [imgLoaded, setImgLoaded] = useState(false);
  const [previewTransform, setPreviewTransform] = useState('translate3d(0px, 0px, 0) scale(1)');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const initialLocation = location.state?.location;
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitAreaRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cropPixelRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const currentZoomRef = useRef(1);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef({ distance: 0, zoom: 1 });
  const touchPinchStartRef = useRef({ distance: 0, zoom: 1 });

  useEffect(() => {
    if (!initialLocation) {
      setAddress('위치 미지정');
      return;
    }
    const { lat, lng } = initialLocation;
    let cancelled = false;

    const setFallbackAddress = () => {
      const district = getSeoulDistrict(lat, lng);
      setAddress(district ?? resolveOfflineLocationName(lat, lng));
    };

    loadKakaoMapsSdk()
      .then(() => {
        if (cancelled) return;
        const kakao = (window as any).kakao;
        if (!kakao?.maps?.services) {
          setFallbackAddress();
          return;
        }
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.coord2Address(lng, lat, (result: any, status: any) => {
          if (cancelled) return;
          if (status === kakao.maps.services.Status.OK && result[0]) {
            const addr = result[0].address;
            setAddress(formatAdministrativeAddress(
              addr.region_1depth_name,
              addr.region_2depth_name,
              addr.region_3depth_name
            ));
          } else {
            setFallbackAddress();
          }
        });
      })
      .catch(() => {
        if (!cancelled) setFallbackAddress();
      });

    return () => {
      cancelled = true;
    };
  }, [initialLocation]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Write 페이지에서 돌아올 때 지도가 현재 위치로 자동이동하지 않도록 플래그 설정
    mapCache.keepPosition = true;
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let baseHeight = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);

    const updateKeyboardHeight = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      baseHeight = Math.max(baseHeight, window.innerHeight, viewportHeight);
      const height = Math.max(0, baseHeight - viewportHeight - viewportTop);
      setKeyboardHeight(height > 120 ? height : 0);
    };

    updateKeyboardHeight();
    window.visualViewport?.addEventListener('resize', updateKeyboardHeight);
    window.visualViewport?.addEventListener('scroll', updateKeyboardHeight);
    window.addEventListener('resize', updateKeyboardHeight);
    window.addEventListener('orientationchange', updateKeyboardHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardHeight);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardHeight);
      window.removeEventListener('resize', updateKeyboardHeight);
      window.removeEventListener('orientationchange', updateKeyboardHeight);
    };
  }, []);

  const animateScrollAreaTo = (targetTop: number) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }

    const startTop = scrollArea.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 2) return;

    const duration = 150;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      scrollArea.scrollTop = startTop + distance * eased;

      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimationRef.current = null;
      }
    };

    scrollAnimationRef.current = requestAnimationFrame(step);
  };

  const bringTextareaAboveKeyboard = () => {
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = window.setTimeout(() => {
      scrollTimerRef.current = null;
      const textarea = textareaRef.current;
      const scrollArea = scrollAreaRef.current;
      if (!textarea || !scrollArea) return;

      const viewport = window.visualViewport;
      const visibleBottom = (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0) - 18;
      const targetRect = textarea.getBoundingClientRect();
      const overflow = targetRect.bottom - visibleBottom;

      if (overflow > 0) {
        animateScrollAreaTo(scrollArea.scrollTop + overflow + 150);
      }
    }, 120);
  };

  useEffect(() => {
    if (keyboardHeight > 0 && currentPage === 2 && document.activeElement === textareaRef.current) {
      bringTextareaAboveKeyboard();
    }
  }, [keyboardHeight, currentPage]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
    };
  }, []);

  const handleTextareaInteraction = () => {
    bringTextareaAboveKeyboard();
  };

  useEffect(() => {
    cropPixelRef.current = { x: 0, y: 0 };
    currentZoomRef.current = mediaFiles[currentSlide]?.zoom ?? 1;
    activePointersRef.current.clear();
    setPreviewTransform(`translate3d(0px, 0px, 0) scale(${currentZoomRef.current})`);
    // ✅ 슬라이드 변경 시 로드 상태 초기화
    setImgLoaded(false);
  }, [currentSlide]);

  const getMaxOffset = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { maxX: 0, maxY: 0 };
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { maxX: 0, maxY: 0 };
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / natW, conH / natH);
    const zoom = currentZoomRef.current;
    const renderedW = natW * scale * zoom;
    const renderedH = natH * scale * zoom;
    return {
      maxX: Math.max(0, (renderedW - conW) / 2),
      maxY: Math.max(0, (renderedH - conH) / 2),
    };
  };

  const pixelToPercent = (offsetX: number, offsetY: number, zoom = currentZoomRef.current) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: 50, y: 50 };
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { x: 50, y: 50 };
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / natW, conH / natH);
    const renderedW = natW * scale * zoom;
    const renderedH = natH * scale * zoom;
    const x = renderedW <= conW ? 50 : 50 + (offsetX / (renderedW - conW)) * 100;
    const y = renderedH <= conH ? 50 : 50 + (offsetY / (renderedH - conH)) * 100;
    return { x, y };
  };

  const percentToPixel = (crop = { x: 50, y: 50 }, zoom = currentZoomRef.current) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return { x: 0, y: 0 };
    const conW = container.offsetWidth;
    const conH = container.offsetHeight;
    const scale = Math.max(conW / img.naturalWidth, conH / img.naturalHeight);
    const renderedW = img.naturalWidth * scale * zoom;
    const renderedH = img.naturalHeight * scale * zoom;
    return {
      x: renderedW <= conW ? 0 : ((crop.x - 50) / 100) * (renderedW - conW),
      y: renderedH <= conH ? 0 : ((crop.y - 50) / 100) * (renderedH - conH),
    };
  };

  const updateCurrentMediaTransform = (zoom = currentZoomRef.current) => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    currentZoomRef.current = Math.max(1, Math.min(4, zoom));
    applyPreviewPlacement();
  };

  const applyPreviewPlacement = () => {
    const img = imgRef.current;
    if (!img) return null;
    const { maxX, maxY } = getMaxOffset();
    cropPixelRef.current.x = Math.max(-maxX, Math.min(maxX, cropPixelRef.current.x));
    cropPixelRef.current.y = Math.max(-maxY, Math.min(maxY, cropPixelRef.current.y));
    const { x, y } = pixelToPercent(cropPixelRef.current.x, cropPixelRef.current.y);
    const transform = `translate3d(${-cropPixelRef.current.x}px, ${-cropPixelRef.current.y}px, 0) scale(${currentZoomRef.current})`;
    img.style.objectPosition = '50% 50%';
    img.style.transform = transform;
    return { x, y, transform };
  };

  const commitCurrentMediaPlacement = () => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    const placement = applyPreviewPlacement();
    if (!placement) return;
    setPreviewTransform(placement.transform);
    const newMedia = [...mediaFiles];
    newMedia[currentSlide] = { ...newMedia[currentSlide], crop: placement, zoom: currentZoomRef.current };
    setMediaFiles(newMedia);
  };

  const applyDrag = (deltaX: number, deltaY: number) => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    const { maxX, maxY } = getMaxOffset();
    cropPixelRef.current.x = Math.max(-maxX, Math.min(maxX, cropPixelRef.current.x - deltaX));
    cropPixelRef.current.y = Math.max(-maxY, Math.min(maxY, cropPixelRef.current.y - deltaY));
    applyPreviewPlacement();
  };

  const getPointerDistance = () => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mediaFiles[currentSlide]?.type !== 'image') return;
    e.stopPropagation();

    if (e.touches.length >= 2) {
      isDraggingRef.current = false;
      touchPinchStartRef.current = {
        distance: getTouchDistance(e.touches),
        zoom: currentZoomRef.current,
      };
      setIsDragging(true);
      return;
    }

    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mediaFiles[currentSlide]?.type !== 'image') return;
    e.stopPropagation();

    if (e.touches.length >= 2) {
      const distance = getTouchDistance(e.touches);
      if (touchPinchStartRef.current.distance > 0) {
        updateCurrentMediaTransform(touchPinchStartRef.current.zoom * (distance / touchPinchStartRef.current.distance));
      }
      return;
    }

    if (e.touches.length === 1 && isDraggingRef.current) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mediaFiles[currentSlide]?.type !== 'image') return;
    e.stopPropagation();

    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);
    commitCurrentMediaPlacement();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (mediaFiles[currentSlide]?.type !== 'image') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      isDraggingRef.current = false;
      const distance = getPointerDistance();
      pinchStartRef.current = { distance, zoom: currentZoomRef.current };
      setIsDragging(true);
      return;
    }

    handleDragStart(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!e.isPrimary && !activePointersRef.current.has(e.pointerId)) return;
    if (!activePointersRef.current.has(e.pointerId) && !isDraggingRef.current) return;
    e.stopPropagation();
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size >= 2) {
      const distance = getPointerDistance();
      if (pinchStartRef.current.distance > 0) {
        updateCurrentMediaTransform(pinchStartRef.current.zoom * (distance / pinchStartRef.current.distance));
      }
      return;
    }

    if (isDraggingRef.current) handleDragMove(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!e.isPrimary && !activePointersRef.current.has(e.pointerId)) return;
    e.stopPropagation();
    activePointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartRef.current = remaining;
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);
    commitCurrentMediaPlacement();
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mediaFiles[currentSlide]?.type !== 'image') return;
    e.stopPropagation();
    updateCurrentMediaTransform(currentZoomRef.current * (e.deltaY < 0 ? 1.06 : 0.94));
    commitCurrentMediaPlacement();
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    const media = mediaFiles[currentSlide];
    if (!media || media.type !== 'image') return;
    const img = imgRef.current;
    const container = containerRef.current;
    if (img && container && img.naturalWidth) {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const conW = container.offsetWidth;
      const conH = container.offsetHeight;
      currentZoomRef.current = Math.max(currentZoomRef.current, media.zoom ?? 1);
      cropPixelRef.current = percentToPixel(media.crop ?? { x: 50, y: 50 }, currentZoomRef.current);
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    dragStartRef.current = { x: clientX, y: clientY };
    applyDrag(deltaX, deltaY);
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    commitCurrentMediaPlacement();
  };

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems = await Promise.all(files.map(async (file) => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const url = URL.createObjectURL(file);
      let orientation: 'landscape' | 'portrait' = 'landscape';
      let thumbnailBlob: Blob | undefined;

      if (type === 'image') {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      } else if (type === 'video') {
        // 파일 선택 시점에 미리 썸네일 생성 (업로드 시 재사용)
        try {
          thumbnailBlob = await createVideoThumbnail(file);
        } catch (err) {
          console.warn('[Write] 썸네일 미리 생성 실패, 업로드 시 재시도:', err);
        }
      }

      return { file, url, type, crop: { x: 50, y: 50 }, zoom: 1, orientation, thumbnailBlob } as MediaFile;
    }));

    setMediaFiles([...mediaFiles, ...newItems]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handlePost = async () => {
    if (!authUser) return;
    
    if (mediaFiles.length === 0) {
      showError('최소 한 장 이상의 사진이나 동영상을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedMedia: Array<{ url: string; type: 'image' | 'video'; previewUrl: string }> = [];
      const mediaToUpload = [...mediaFiles];

      for (const [index, media] of mediaToUpload.entries()) {
        const timestamp = new Date().getTime();
        const bucketName = media.type === 'video' ? 'post-videos' : 'post-images';
        const fileExt = media.file.name.split('.').pop() || (media.type === 'video' ? 'mp4' : 'jpg');
        const fileName = `${timestamp}-${index}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${authUser.id}/${fileName}`;
        
        // 이미지인 경우 3:4 프레임에서 사용자가 맞춘 위치 그대로 잘라서 업로드
        const fileToUpload = media.type === 'image'
          ? await cropImageToAspectRatio(media.file, media.crop ?? { x: 50, y: 50 }, media.zoom ?? 1).catch(() => media.file)
          : media.file;

        const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: media.type === 'image' ? 'image/jpeg' : (media.file.type || 'video/mp4')
        });

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(filePath);

        if (media.type === 'video') {
          // 미리 생성된 thumbnailBlob 우선 사용, 없으면 재시도
          let thumbnailBlob = media.thumbnailBlob;
          if (!thumbnailBlob) {
            try {
              thumbnailBlob = await createVideoThumbnail(media.file);
            } catch (err) {
              console.error('[Write] 썸네일 생성 실패:', err);
            }
          }

          if (thumbnailBlob) {
            const thumbnailFileName = `${timestamp}-${index}-${Math.random().toString(36).substring(7)}-thumb.jpg`;
            const thumbnailPath = `${authUser.id}/${thumbnailFileName}`;

            const { error: thumbnailUploadError } = await supabase.storage
              .from('post-images')
              .upload(thumbnailPath, thumbnailBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'image/jpeg',
              });

            if (thumbnailUploadError) {
              console.error('[Write] 썸네일 업로드 실패:', thumbnailUploadError);
              // 썸네일 업로드 실패 시 비디오 URL 대신 빈 문자열로 fallback (마커에서 기본 이미지 표시)
              uploadedMedia.push({ url: publicUrl, type: media.type, previewUrl: '' });
            } else {
              const { data: { publicUrl: thumbnailUrl } } = supabase.storage
                .from('post-images')
                .getPublicUrl(thumbnailPath);
              uploadedMedia.push({ url: publicUrl, type: media.type, previewUrl: thumbnailUrl });
            }
          } else {
            // 썸네일 생성 자체가 실패한 경우 - 비디오 URL 대신 빈 문자열
            uploadedMedia.push({ url: publicUrl, type: media.type, previewUrl: '' });
          }
        } else {
          uploadedMedia.push({ url: publicUrl, type: media.type, previewUrl: publicUrl });
        }
      }

      const uploadedUrls = uploadedMedia.map((item) => item.url);
      const previewUrls = uploadedMedia.map((item) => item.previewUrl);

      // 위치 정보는 사용자가 명시적으로 선택한 경우에만 저장한다.
      // 선택하지 않았을 때 지도 중심/마지막 위치를 fallback으로 넣으면
      // 위치 미지정 포스트가 엉뚱한 곳에 마커로 표시된다.
      const hasSelectedLocation =
        Number.isFinite(initialLocation?.lat) && Number.isFinite(initialLocation?.lng);
      const postLat = hasSelectedLocation ? initialLocation.lat : null;
      const postLng = hasSelectedLocation ? initialLocation.lng : null;

      const firstUploadedMedia = uploadedMedia[0];
      const isFirstMediaVideo = firstUploadedMedia?.type === 'video';
      
      const postData = {
        content: content.trim(),
        location_name: hasSelectedLocation ? (address || '위치 선택됨') : '위치 미지정',
        latitude: postLat,
        longitude: postLng,
        image_url: previewUrls[0],
        images: previewUrls,
        user_id: authUser.id,
        user_name: profile?.nickname || '탐험가',
        user_avatar: profile?.avatar_url,
        category,
        video_url: isFirstMediaVideo ? firstUploadedMedia.url : null,
        hashtags,
      };

      const { data: createdPost, error: insertError } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (insertError) {
        console.error('[Write] Post insert error:', insertError);
        throw insertError;
      }

      // ✅ [FIX] 등록된 포스트의 실제 데이터를 포함하여 메인으로 이동
      // Index.tsx에서 이 데이터를 기반으로 위치를 잡고 마커를 보여줌
      const mappedPost = {
        id: createdPost.id,
        user_id: authUser.id,
        owner_id: authUser.id,
        isAd: createdPost.content?.startsWith('[AD]'),
        isGif: false,
        isInfluencer: false,
        user: {
          id: authUser.id,
          name: profile?.nickname || '탐험가',
          avatar: profile?.avatar_url
        },
        content: createdPost.content,
        location: createdPost.location_name,
        lat: createdPost.latitude,
        lng: createdPost.longitude,
        likes: 0,
        image: previewUrls[0],
        image_url: previewUrls[0],
        images: previewUrls,
        videoUrl: createdPost.video_url,
        createdAt: new Date(createdPost.created_at),
        category: createdPost.category,
        hashtags: createdPost.hashtags || hashtags,
        borderType: 'none',
      };

      showSuccess('게시물이 등록되었습니다! ✨');
      clear();
      postDraftStore.clear();
      
      // 업로드 완료 후 메인으로 이동한다.
      // 위치 미지정 포스트는 post/center로 전달하지 않아 지도 마커 생성 경로에 들어가지 않게 한다.
      const hasCreatedLocation = mappedPost.lat != null && mappedPost.lng != null;
      const navigateCenter = hasCreatedLocation
        ? { lat: mappedPost.lat, lng: mappedPost.lng }
        : undefined;
      navigate('/', {
        state: {
          triggerConfetti: true,
          filterUserId: 'me',
          post: hasCreatedLocation ? mappedPost : undefined,
          center: navigateCenter,
        },
        replace: true
      });
    } catch (err: any) {
      showError('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMedia = mediaFiles[currentSlide];

  return (
    <div className="h-[100dvh] bg-white flex flex-col relative overflow-hidden">
      {/* 고정 헤더(Header.tsx) 높이만큼만 정확히 공간 확보 - pt-16으로 통일 */}
      <div className="pt-16 h-full flex flex-col overflow-hidden">
        {/* 고정 타이틀 영역 */}
        <div className="bg-gray-50/50 border-y border-gray-100 shrink-0">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                  <PenLine className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 tracking-tight">
                    {currentPage === 1 ? '새 게시물 작성' : '상세 정보 입력'}
                  </h2>
                  <p className="text-[10px] text-gray-400 font-medium leading-none uppercase tracking-widest">Leave your trace</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    postDraftStore.clear();
                    mapCache.keepPosition = true;
                    navigate('/');
                  }}
                  aria-label="작성 취소하고 닫기"
                  className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-800 active:scale-95 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <main
          ref={scrollAreaRef}
          className={cn(
            "flex-1 min-h-0 no-scrollbar overscroll-contain bg-white",
            currentPage === 1 ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "px-5 space-y-6",
              currentPage === 1 ? "pt-3" : "pt-6"
            )}
            style={{
              paddingBottom: keyboardHeight > 0
                ? `calc(${keyboardHeight}px + 3rem + env(safe-area-inset-bottom, 0px))`
                : 'calc(5rem + env(safe-area-inset-bottom, 0px) + 24px)'
            }}
          >
            {currentPage === 1 ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">미디어 첨부</p>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                    {mediaFiles.length > 0 && currentMedia?.type === 'image' && (
                      <span className="ml-1 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-600">드래그로 위치 조정</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">다음</span>
                      <button
                        type="button"
                        onClick={() => mediaFiles.length > 0 && setCurrentPage(2)}
                        disabled={mediaFiles.length === 0}
                        aria-label="다음 단계로"
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                          mediaFiles.length === 0
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-500 text-white shadow-md shadow-indigo-200 active:scale-90"
                        )}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <input type="file" ref={mediaInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleMediaSelect} />
                </div>

                {mediaFiles.length > 0 ? (
                  <div className="space-y-3">
                    <div
                      ref={containerRef}
                      className="w-full rounded-[32px] overflow-hidden shadow-2xl relative select-none bg-slate-100"
                      style={{ aspectRatio: '3 / 4', touchAction: currentMedia?.type === 'image' ? 'none' : 'auto' }}
                    >
                      {currentMedia?.type === 'image' ? (
                        <img
                          ref={imgRef}
                          src={currentMedia.url}
                          className="pointer-events-none"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            const container = containerRef.current;
                            if (!container) return;
                            const conW = container.offsetWidth;
                            const conH = container.offsetHeight;
                            const scale = Math.max(conW / img.naturalWidth, conH / img.naturalHeight);
                            currentZoomRef.current = currentMedia.zoom ?? 1;
                            cropPixelRef.current = percentToPixel(currentMedia.crop ?? { x: 50, y: 50 }, currentZoomRef.current);
                            const placement = applyPreviewPlacement();
                            if (placement) setPreviewTransform(placement.transform);
                            // ✅ 로드 완료 → 렌더링 트리거
                            setImgLoaded(true);
                          }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: '50% 50%',
                            transform: previewTransform,
                            transformOrigin: 'center center',
                            // ✅ 로드 전엔 invisible, 로드 후 보임
                            opacity: imgLoaded ? 1 : 0,
                            transition: isDragging
                              ? 'none'
                              : 'transform 0.2s ease, opacity 0.2s ease',
                          }}
                        />
                      ) : (
                        <video
                          src={currentMedia?.url}
                          className="video-hq"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          autoPlay muted loop playsInline
                        />
                      )}

                      {/* 드래그 오버레이 */}
                      <div
                        className="absolute inset-0 z-10"
                        style={{
                          cursor: currentMedia?.type === 'image' ? (isDragging ? 'grabbing' : 'grab') : 'default',
                          touchAction: currentMedia?.type === 'image' ? 'none' : 'auto',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerEnd}
                        onPointerCancel={handlePointerEnd}
                        onPointerLeave={(e) => {
                          if (e.pointerType === 'mouse') handlePointerEnd(e);
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        onWheel={handleWheelZoom}
                      />

                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFiles = [...mediaFiles];
                          newFiles.splice(currentSlide, 1);
                          setMediaFiles(newFiles);
                          setCurrentSlide(prev => Math.min(prev, Math.max(0, newFiles.length - 1)));
                        }}
                        className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-30"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* 슬라이드 전환 + 인디케이터 */}
                      {mediaFiles.length > 1 && (
                        <>
                          {/* 왼쪽 화살표 버튼 */}
                          {currentSlide > 0 && (
                            <button
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
                              onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => Math.max(0, prev - 1)); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                          )}
                          {/* 오른쪽 화살표 버튼 */}
                          {currentSlide < mediaFiles.length - 1 && (
                            <button
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
                              onClick={(e) => { e.stopPropagation(); setCurrentSlide(prev => Math.min(mediaFiles.length - 1, prev + 1)); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          )}
                          {/* 인디케이터 */}
                          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
                            {mediaFiles.map((_, i) => (
                              <div key={i} className={cn("h-1.5 rounded-full transition-all", currentSlide === i ? "bg-white w-6" : "bg-white/40 w-1.5")} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => mediaInputRef.current?.click()}
                    className="w-full rounded-[32px] bg-gray-50 border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors flex flex-col items-center justify-center gap-4 pb-15"
                    style={{ aspectRatio: '3 / 4' }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-20 h-20 bg-indigo-50 rounded-[20px] flex items-center justify-center shadow-sm">
                        <ImageIcon className="w-10 h-10 text-indigo-500" />
                      </div>
                      <span className="text-gray-700 font-bold text-base tracking-tight">사진 / 동영상 선택</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">장소 정보</p>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">(선택)</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        aria-label="이전 단계로"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-indigo-500 text-white shadow-md shadow-indigo-200 active:scale-90"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-bold text-gray-900">뒤로</span>
                    </div>
                  </div>
                  <div
                    onClick={() => navigate('/', { state: { startSelection: true } })}
                    className="p-3 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-4 cursor-pointer hover:bg-gray-100 active:scale-[0.98] transition-all"
                  >
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <MapPin className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className={cn("font-normal truncate", address === '위치 미지정' ? "text-gray-400" : "text-gray-900")}>
                      {address || '위치 미지정'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">카테고리</p>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        onClick={() => setCategory(cat.key)}
                        className={cn(
                          "flex flex-col items-center justify-center h-16 rounded-2xl border-2 transition-all",
                          category === cat.key ? "border-indigo-600 bg-indigo-50" : "border-gray-100 bg-white"
                        )}
                      >
                        <cat.Icon className={cn("w-6 h-6", category === cat.key ? "text-indigo-600" : "text-gray-400")} />
                        <span className={cn("text-[10px] font-normal mt-2", category === cat.key ? "text-indigo-600" : "text-gray-500")}>
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">내용 입력</p>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">(필수)</span>
                    <span
                      className={cn(
                        "ml-auto text-[10px] font-black text-rose-500",
                        !content.trim() ? "visible" : "invisible"
                      )}
                      aria-hidden={!!content.trim()}
                    >
                      내용을 입력해주세요.
                    </span>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    placeholder="이 장소에서의 추억을 기록해보세요. 예) 오늘 노을 최고 #한강 #산책"
                    className="min-h-[120px] bg-gray-50 border-none rounded-[32px] p-6 text-base font-normal placeholder:font-normal focus-visible:ring-2 focus-visible:ring-indigo-600"
                    value={content}
                    onFocus={handleTextareaInteraction}
                    onClick={handleTextareaInteraction}
                    onTouchStart={handleTextareaInteraction}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <div className="rounded-[28px] border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black">해시태그 자동 인식</p>
                        <p className="text-[10px] font-bold text-indigo-400">본문에 #태그를 쓰면 검색에 정확히 반영돼요.</p>
                      </div>
                    </div>
                    {hashtags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {hashtags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-indigo-600 shadow-sm">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 페이지 2 등록 버튼 영역 */}
            {currentPage === 2 && (
              <div ref={submitAreaRef} className="-mt-2">
                {(() => {
                  const isDisabled = isSubmitting || !content.trim() || mediaFiles.length === 0;
                  return (
                    <button
                      type="button"
                      onClick={handlePost}
                      disabled={isDisabled}
                      className={cn(
                        "w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-base font-black tracking-tight transition-all",
                        isDisabled
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 active:scale-[0.98]"
                      )}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      <span>등록하기</span>
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Write;