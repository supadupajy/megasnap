import React, { useState } from 'react';
import { ChevronLeft, CheckCircle2, Database, Image, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn, compressImage } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';

type CompressionStatus = 'idle' | 'running' | 'done' | 'error';
type CompressionResult =
  | { action: 'optimized' }
  | { action: 'skipped'; reason: string };

const MAX_IMAGE_SIZE = 1920;
const JPEG_QUALITY = 0.82;
const BATCH_SIZE = 1000;

const DBImageCompression = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CompressionStatus>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const getSupabasePath = (url: string): { bucket: string; path: string } | null => {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+)$/);
      if (!match) return null;
      return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
    } catch {
      return null;
    }
  };

  const getDirectPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const directUrl = new URL(data.publicUrl);
    directUrl.searchParams.set('optimize_ts', Date.now().toString());
    return directUrl.toString();
  };

  const getImageSize = (blob: Blob): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new window.Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('이미지 크기를 확인할 수 없습니다.'));
      };

      img.src = objectUrl;
    });
  };

  const recompressUrl = async (url: string): Promise<CompressionResult | null> => {
    const source = getSupabasePath(url);
    if (!source) return null;
    if (source.bucket === 'post-videos') return { action: 'skipped', reason: '동영상 썸네일 제외' };

    const res = await fetch(getDirectPublicUrl(source.bucket, source.path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`fetch 실패: ${res.status}`);

    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return { action: 'skipped', reason: '이미지 파일 아님' };
    if (blob.type === 'image/svg+xml') return { action: 'skipped', reason: 'SVG 제외' };
    if (blob.type === 'image/gif') return { action: 'skipped', reason: 'GIF 제외' };

    const { width, height } = await getImageSize(blob);
    const isAlreadySafeJpeg = blob.type === 'image/jpeg' && width <= MAX_IMAGE_SIZE && height <= MAX_IMAGE_SIZE;
    if (isAlreadySafeJpeg) {
      return { action: 'skipped', reason: `이미 최적화됨 (${width}×${height} JPEG)` };
    }

    const file = new File([blob], 'source-image', { type: blob.type });
    const compressed = await compressImage(file, MAX_IMAGE_SIZE, JPEG_QUALITY);

    const { error } = await supabase.storage
      .from(source.bucket)
      .upload(source.path, compressed, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (error) throw error;
    return { action: 'optimized' };
  };

  const fetchPostImageUrls = async () => {
    const urlSet = new Set<string>();
    let from = 0;

    while (true) {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, image_url, images')
        .range(from, from + BATCH_SIZE - 1);

      if (error) throw error;
      if (!posts || posts.length === 0) break;

      for (const post of posts) {
        if (typeof post.image_url === 'string' && post.image_url) urlSet.add(post.image_url);
        if (Array.isArray(post.images)) {
          post.images.forEach((imageUrl: unknown) => {
            if (typeof imageUrl === 'string' && imageUrl) urlSet.add(imageUrl);
          });
        }
      }

      if (posts.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    return Array.from(urlSet);
  };

  const handleRun = async () => {
    setStatus('running');
    setLog([]);
    setProgress({ done: 0, total: 0 });

    try {
      const urls = await fetchPostImageUrls();
      setProgress({ done: 0, total: urls.length });
      addLog(`총 ${urls.length}개 이미지 발견`);

      let optimizedCount = 0;
      let skipCount = 0;
      let failCount = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const shortUrl = url.split('/').slice(-2).join('/');

        try {
          const result = await recompressUrl(url);
          if (result?.action === 'optimized') {
            optimizedCount++;
            addLog(`✅ [${i + 1}/${urls.length}] 최적화 완료: ${shortUrl}`);
          } else {
            skipCount++;
            addLog(`⏭️ [${i + 1}/${urls.length}] 건너뜀: ${shortUrl}${result?.reason ? ` — ${result.reason}` : ''}`);
          }
        } catch (err: any) {
          failCount++;
          addLog(`❌ [${i + 1}/${urls.length}] 실패: ${shortUrl} — ${err.message}`);
        }

        setProgress({ done: i + 1, total: urls.length });
      }

      addLog(`\n완료! 최적화 ${optimizedCount}개 / 건너뜀 ${skipCount}개 / 실패 ${failCount}개`);
      setStatus('done');
      if (failCount === 0) showSuccess(`이미지 최적화 완료! 새로 압축 ${optimizedCount}개, 건너뜀 ${skipCount}개`);
    } catch (err: any) {
      addLog(`치명적 오류: ${err.message}`);
      setStatus('error');
      showError('이미지 압축 중 오류가 발생했습니다.');
    }
  };

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate('/settings');
          }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10 pointer-events-none">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">DB 원본 이미지 압축</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-4 mt-5 rounded-3xl bg-orange-500 p-5 text-white shadow-xl shadow-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/75 uppercase tracking-widest">Admin · Storage Tool</p>
              <p className="text-lg font-black leading-tight">DB 원본 이미지 최적화</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/85">
            포스트 DB에 연결된 원본 이미지를 확인해, 필요한 파일만 최대 {MAX_IMAGE_SIZE}px / JPEG {Math.round(JPEG_QUALITY * 100)}% 기준으로 압축합니다.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-white/15 px-3 py-2 text-[11px] font-bold leading-relaxed text-white">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            이미 JPEG이고 긴 변이 {MAX_IMAGE_SIZE}px 이하인 이미지는 건너뛰므로, 여러 번 실행해도 반복 압축되지 않습니다.
          </div>
        </div>

        <div className="mx-4 mt-5 bg-white rounded-3xl border border-orange-100 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0">
                <Image className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-[15px] font-black text-gray-900" style={{ letterSpacing: '-0.04em' }}>DB 원본 이미지 압축</p>
                <p className="text-[11px] text-gray-400 font-medium">미최적화 이미지만 JPEG 82%로 변환하고 같은 Storage 경로에 저장합니다</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {status === 'running' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500">
                  <span>{progress.done} / {progress.total} 처리 중...</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {log.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-0.5">
                {log.map((line, i) => (
                  <p key={i} className="text-[10px] font-mono text-gray-600 leading-relaxed whitespace-pre-wrap">{line}</p>
                ))}
              </div>
            )}

            <Button
              onClick={handleRun}
              disabled={status === 'running'}
              className={cn(
                'w-full h-12 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2',
                status === 'done'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-600'
                  : status === 'error'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-orange-500 text-white shadow-lg shadow-orange-100 hover:bg-orange-600 disabled:opacity-50'
              )}
            >
              {status === 'running'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> 압축 중...</>
                : status === 'done'
                  ? <><CheckCircle2 className="w-4 h-4" /> 완료됨 · 다시 검사하기</>
                  : <><RefreshCw className="w-4 h-4" /> DB 원본 이미지 압축 시작</>}
            </Button>

            <p className="text-[10px] text-gray-400 font-medium text-center leading-relaxed">
              JPEG이 아니거나 1920px을 초과하는 이미지에만 압축을 적용합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DBImageCompression;
