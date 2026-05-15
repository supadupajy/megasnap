import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPin, Heart, Download, ExternalLink, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getFallbackImage, getOptimizedFeedImage } from '@/lib/utils';
import { useMediaAspectRatio } from '@/hooks/use-media-aspect-ratio';

const ANDROID_PACKAGE = 'com.chorasnap.chorasnap';
const IOS_APP_ID = '0000000000'; // 실제 App Store ID로 교체 필요
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;
const APP_SCHEME = 'chorasnap';

interface PostPreview {
  id: string;
  content: string;
  image_url: string | null;
  images: string[] | null;
  location_name: string | null;
  likes: number;
  user_name: string | null;
  user_avatar: string | null;
  created_at: string;
}

interface Props {
  postId: string;
}

const isValidUrl = (url: any): boolean => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (/post\s*content/i.test(clean)) return false;
  return clean.startsWith('http');
};

const PostDeepLinkLanding: React.FC<Props> = ({ postId }) => {
  const navigate = useNavigate();
  const [post, setPost] = useState<PostPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepLinkAttempted, setDeepLinkAttempted] = useState(false);

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;
  const storeUrl = isIOS ? APP_STORE_URL : PLAY_STORE_URL;

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('id, content, image_url, images, location_name, likes, user_name, user_avatar, created_at')
          .eq('id', postId)
          .maybeSingle();

        if (!error && data) {
          setPost(data as PostPreview);
        }
      } catch (err) {
        console.error('[PostDeepLinkLanding] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // 모바일에서 앱 실행 시도 (딥링크)
  useEffect(() => {
    if (!isMobile || deepLinkAttempted) return;
    setDeepLinkAttempted(true);

    const deepLinkUrl = `${APP_SCHEME}://post/${postId}`;
    const start = Date.now();

    // iframe을 통한 딥링크 시도 (페이지 이탈 없이)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLinkUrl;
    document.body.appendChild(iframe);

    const timer = setTimeout(() => {
      document.body.removeChild(iframe);
      // 앱이 열리지 않았으면 (페이지가 여전히 visible) 스토어 이동 버튼 강조
      if (!document.hidden && Date.now() - start < 3000) {
        // 스토어 버튼을 pulse 애니메이션으로 강조 (자동 이동 X - 사용자 선택)
      }
    }, 2000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  }, [postId, isMobile]);

  const handleOpenApp = () => {
    const deepLinkUrl = `${APP_SCHEME}://post/${postId}`;
    window.location.href = deepLinkUrl;

    // 앱이 없으면 스토어로
    setTimeout(() => {
      if (!document.hidden) {
        window.location.href = storeUrl;
      }
    }, 1500);
  };

  const handleDownload = () => {
    window.open(storeUrl, '_blank');
  };

  const handleLoginAndView = () => {
    navigate('/login', { state: { redirectTo: `/post/${postId}` } });
  };

  const getRawPostImage = (): string | null => {
    if (!post) return null;
    const imgs = Array.isArray(post.images) ? post.images.filter(isValidUrl) : [];
    return imgs.length > 0 ? imgs[0] : (isValidUrl(post.image_url) ? post.image_url! : null);
  };

  const rawPostImage = getRawPostImage();
  const postImage = rawPostImage ? getOptimizedFeedImage(rawPostImage, postId) : getFallbackImage(postId);
  const mediaAspectRatio = useMediaAspectRatio(rawPostImage, 'image');

  const getContentPreview = (): string => {
    if (!post?.content) return '';
    const clean = post.content.replace(/^\[AD\]\s*/, '');
    return clean.length > 120 ? clean.slice(0, 120) + '...' : clean;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* 앱 브랜딩 헤더 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-indigo-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden">
            <img src="/tocatoca-logo.png" alt="TocaToca" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-gray-900 text-lg tracking-tight">TocaToca</span>
        </div>
        <button
          onClick={handleLoginAndView}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          로그인
        </button>
      </div>

      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 py-6 gap-5">
        {/* 포스트 미리보기 카드 */}
        {post ? (
          <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
            {/* 포스트 이미지 */}
            <div className="relative bg-gray-100 transition-[height] duration-300" style={{ aspectRatio: mediaAspectRatio }}>
              <img
                src={postImage}
                alt="컨텐츠 이미지"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getFallbackImage(postId);
                }}
              />
              {/* 블러 오버레이 - 로그인 유도 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-2">
                  <img
                    src={post.user_avatar || '/placeholder.svg'}
                    alt={post.user_name || ''}
                    className="w-8 h-8 rounded-full border-2 border-white object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                  />
                  <span className="text-white font-bold text-sm drop-shadow">
                    {post.user_name || '탐험가'}
                  </span>
                </div>
              </div>
            </div>

            {/* 포스트 정보 */}
            <div className="p-4 space-y-3">
              {post.location_name && (
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold truncate">{post.location_name}</span>
                </div>
              )}

              {getContentPreview() && (
                <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                  {getContentPreview()}
                </p>
              )}

              <div className="flex items-center gap-1.5 text-gray-400">
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium">{post.likes?.toLocaleString() || 0}개의 좋아요</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-lg p-8 text-center border border-gray-100">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-gray-500 font-medium">컨텐츠를 불러올 수 없습니다.</p>
          </div>
        )}

        {/* CTA 섹션 */}
        <div className="bg-white rounded-3xl shadow-lg p-5 border border-gray-100 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black text-gray-900">
              TocaToca에서 전체 내용 보기
            </h2>
            <p className="text-sm text-gray-500">
              지도 기반 여행 컨텐츠 앱 · 내 주변 여행지 발견
            </p>
          </div>

          {isMobile ? (
            <div className="space-y-3">
              {/* 앱 열기 버튼 */}
              <button
                onClick={handleOpenApp}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-indigo-200"
              >
                <Smartphone className="w-5 h-5" />
                앱에서 열기
              </button>

              {/* 스토어 다운로드 버튼 */}
              <button
                onClick={handleDownload}
                className="w-full bg-gray-50 text-gray-700 font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform border border-gray-200"
              >
                <Download className="w-5 h-5 text-gray-500" />
                {isIOS ? 'App Store에서 다운로드' : 'Google Play에서 다운로드'}
              </button>
            </div>
          ) : (
            /* 데스크탑: 로그인 유도 */
            <button
              onClick={handleLoginAndView}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-indigo-200"
            >
              <ExternalLink className="w-5 h-5" />
              로그인하고 보기
            </button>
          )}

          {/* 웹에서 보기 (로그인) */}
          {isMobile && (
            <button
              onClick={handleLoginAndView}
              className="w-full text-sm text-gray-400 font-medium py-1 hover:text-gray-600 transition-colors"
            >
              웹에서 계속하기
            </button>
          )}
        </div>

        {/* 앱 특징 소개 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { emoji: '🗺️', title: '지도 탐색', desc: '내 주변 여행지' },
            { emoji: '📸', title: '포토 공유', desc: '순간을 기록' },
            { emoji: '🤝', title: '친구 연결', desc: '함께 여행' },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-xs font-bold text-gray-800">{item.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PostDeepLinkLanding;