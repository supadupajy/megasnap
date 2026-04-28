import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Tv2,
  Image,
  Link,
  Type,
  Save,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Monitor,
  Search,
  TrendingUp,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  Navigation2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { invalidateAdCache } from '@/hooks/use-ad';
import { resolveOfflineLocationName } from '@/utils/offline-location';

// 카카오 역지오코딩으로 좌표 → 주소 변환
const reverseGeocode = (lat: number, lng: number): Promise<string> => {
  return new Promise(resolve => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) {
      resolve(resolveOfflineLocationName(lat, lng));
      return;
    }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        const addr = result[0].address;
        const city = addr.region_1depth_name || '';
        const gu = addr.region_2depth_name || '';
        const dong = addr.region_3depth_name || '';
        resolve([city, gu, dong].filter(Boolean).join(' '));
      } else {
        resolve(resolveOfflineLocationName(lat, lng));
      }
    });
  });
};

interface AdData {
  id: string;
  label: string;
  image_url: string;
  title: string;
  subtitle: string;
  link_url: string;
  brand_name: string;
  brand_logo_url: string;
  is_active: boolean;
  lat?: number | null;
  lng?: number | null;
}

const AD_ICONS: Record<string, React.ElementType> = {
  splash: Monitor,
  header: Layers,
  search: Search,
  trending: TrendingUp,
  map_marker: MapPin,
};

const AD_COLORS: Record<string, { bg: string; icon: string; border: string; badge: string }> = {
  splash:     { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100',    badge: 'bg-blue-100 text-blue-700' },
  header:     { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  border: 'border-indigo-100',  badge: 'bg-indigo-100 text-indigo-700' },
  search:     { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  trending:   { bg: 'bg-orange-50',  icon: 'text-orange-600',  border: 'border-orange-100',  badge: 'bg-orange-100 text-orange-700' },
  map_marker: { bg: 'bg-rose-50',    icon: 'text-rose-600',    border: 'border-rose-100',    badge: 'bg-rose-100 text-rose-700' },
};

const AD_DESCRIPTIONS: Record<string, string> = {
  splash:     '앱 시작 시 스플래시 화면에 표시되는 광고입니다.',
  header:     '지도 화면 상단 헤더 영역의 배너 광고입니다.',
  search:     '친구 검색 화면 상단에 표시되는 배너 광고입니다.',
  trending:   '실시간 인기 포스팅 패널 내 광고 구좌입니다.',
  map_marker: '지도 위에 표시되는 브랜드 마커 광고입니다.',
};

// ─── 이미지 업로드 필드 ───────────────────────────────────────────────────────
const ImageUploadField = ({
  label, value, onChange, adId, fieldKey, previewType = 'banner',
}: {
  label: string; value: string; onChange: (url: string) => void;
  adId: string; fieldKey: string; previewType?: 'banner' | 'logo';
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showError('파일 크기는 5MB 이하여야 합니다.'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${adId}/${fieldKey}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('ad-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('ad-assets').getPublicUrl(path);
      onChange(data.publicUrl);
      showSuccess('이미지가 업로드되었습니다! 🖼️');
    } catch (err: any) {
      showError('업로드 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isBanner = previewType === 'banner';
  return (
    <div className="bg-gray-50 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Image className="w-3 h-3 text-gray-400" />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={cn('relative w-full rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 cursor-pointer group transition-all hover:border-violet-400', isBanner ? 'h-28' : 'h-16')}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <>
            <img src={value} alt="preview" className={cn('w-full h-full transition-transform duration-300 group-hover:scale-105', isBanner ? 'object-cover' : 'object-contain p-2')} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <Upload className="w-5 h-5 text-white" />
              <span className="text-[10px] font-black text-white">사진 변경</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            {uploading ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" /> : (
              <>
                <Upload className="w-5 h-5 text-gray-300 group-hover:text-violet-400 transition-colors" />
                <span className="text-[10px] font-bold text-gray-300 group-hover:text-violet-400 transition-colors">클릭하여 사진 선택</span>
              </>
            )}
          </div>
        )}
        {uploading && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="또는 URL 직접 입력" className="border-none bg-white rounded-xl focus-visible:ring-violet-300 font-medium text-xs h-8 shadow-sm flex-1" />
        {value && <button onClick={() => onChange('')} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" className="hidden" onChange={handleFileChange} />
    </div>
  );
};

// ─── 일반 텍스트 필드 ─────────────────────────────────────────────────────────
const FieldRow = ({ icon: Icon, label, value, placeholder, onChange }: {
  icon: React.ElementType; label: string; value: string; placeholder: string; onChange: (v: string) => void;
}) => (
  <div className="bg-gray-50 rounded-2xl p-3">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3 text-gray-400" />
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="border-none bg-white rounded-xl focus-visible:ring-violet-300 font-medium text-sm h-9 shadow-sm" />
  </div>
);

// ─── 광고 카드 ────────────────────────────────────────────────────────────────
// initialAd를 초기값으로만 사용하고, 이후 form은 완전히 독립적으로 관리
// key가 바뀌면 컴포넌트가 재마운트되어 initialAd가 새로 적용됨
const AdCard = ({
  initialAd,
  defaultExpanded = false,
  locationFieldRef,
  onSave,
  onSelectLocation,
}: {
  initialAd: AdData;
  defaultExpanded?: boolean;
  locationFieldRef?: React.RefObject<HTMLDivElement>;
  onSave: (updated: AdData) => Promise<void>;
  onSelectLocation: (adId: string) => void;
}) => {
  // ✅ useState 초기값으로만 사용 — useEffect로 덮어쓰지 않음
  const [form, setForm] = useState<AdData>(initialAd);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  const Icon = AD_ICONS[initialAd.id] || Tv2;
  const colors = AD_COLORS[initialAd.id] || AD_COLORS.splash;

  // lat/lng가 있으면 역지오코딩으로 주소 가져오기
  useEffect(() => {
    if (form.lat != null && form.lng != null) {
      setLocationLabel(null); // 로딩 중
      reverseGeocode(form.lat, form.lng).then(addr => setLocationLabel(addr));
    } else {
      setLocationLabel(null);
    }
  }, [form.lat, form.lng]);

  // initialAd와 비교해 변경 여부 판단
  const hasChanges =
    form.title !== initialAd.title ||
    form.subtitle !== initialAd.subtitle ||
    form.link_url !== initialAd.link_url ||
    form.brand_name !== initialAd.brand_name ||
    form.image_url !== initialAd.image_url ||
    form.brand_logo_url !== initialAd.brand_logo_url ||
    form.is_active !== initialAd.is_active ||
    form.lat !== initialAd.lat ||
    form.lng !== initialAd.lng;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const hasLocation = form.lat != null && form.lng != null;

  return (
    <div className={cn('rounded-3xl border overflow-hidden shadow-sm', colors.border, 'bg-white')}>
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setIsExpanded(v => !v)}>
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[13px] font-black text-gray-900 whitespace-nowrap" style={{ letterSpacing: '-0.04em' }}>{initialAd.label}</p>
            <span className={cn('text-[8px] font-black px-1 py-0.5 rounded-md uppercase tracking-wide shrink-0', colors.badge)}>{initialAd.id}</span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium truncate">{AD_DESCRIPTIONS[initialAd.id]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, is_active: !f.is_active })); }}
            className={cn('flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black transition-all', form.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400')}
          >
            {form.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {form.is_active ? 'ON' : 'OFF'}
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </div>

      {/* 접힌 상태 미리보기 */}
      {!isExpanded && (
        <>
          {/* map_marker: 위치 정보 + 이미지 미리보기 */}
          {initialAd.id === 'map_marker' && (
            <div className="px-4 pb-3 space-y-2">
              <button
                onClick={e => { e.stopPropagation(); onSelectLocation(initialAd.id); }}
                className={cn(
                  'w-full flex items-center gap-3 rounded-2xl px-3 h-11 border transition-all active:scale-[0.98]',
                  hasLocation ? 'bg-rose-50 border-rose-100 hover:border-rose-300' : 'bg-gray-50 border-gray-100 hover:border-violet-300'
                )}
              >
                <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center shrink-0', hasLocation ? 'bg-rose-100' : 'bg-gray-100')}>
                  <Navigation2 className={cn('w-3.5 h-3.5', hasLocation ? 'text-rose-500' : 'text-gray-400')} />
                </div>
                <span className={cn('flex-1 text-left text-sm font-semibold truncate', hasLocation ? 'text-gray-900' : 'text-gray-400')}>
                  {hasLocation
                    ? (locationLabel ?? `${form.lat!.toFixed(4)}, ${form.lng!.toFixed(4)}`)
                    : '지도에서 위치 선택'}
                </span>
                {hasLocation
                  ? <span className="text-[10px] font-black text-rose-500 bg-rose-100 px-2 py-0.5 rounded-lg shrink-0">설정됨</span>
                  : <span className="text-[10px] font-black text-violet-500 bg-violet-50 px-2 py-0.5 rounded-lg shrink-0">선택하기</span>
                }
              </button>
              {form.image_url && (
                <div className="w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          )}
          {/* 그 외: 배너 이미지 미리보기 */}
          {initialAd.id !== 'map_marker' && form.image_url && (
            <div className="px-4 pb-3">
              <div className="w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            </div>
          )}
        </>
      )}

      {/* 편집 폼 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
          <FieldRow icon={Type} label="제목" value={form.title} placeholder="광고 제목" onChange={v => setForm(f => ({ ...f, title: v }))} />
          <FieldRow icon={Type} label="부제목" value={form.subtitle} placeholder="광고 부제목" onChange={v => setForm(f => ({ ...f, subtitle: v }))} />
          <FieldRow icon={Link} label="랜딩 URL" value={form.link_url} placeholder="https://example.com" onChange={v => setForm(f => ({ ...f, link_url: v }))} />
          <FieldRow icon={Type} label="브랜드명" value={form.brand_name} placeholder="브랜드 이름" onChange={v => setForm(f => ({ ...f, brand_name: v }))} />
          <ImageUploadField label="배너 이미지" value={form.image_url} onChange={v => setForm(f => ({ ...f, image_url: v }))} adId={initialAd.id} fieldKey="banner" previewType="banner" />
          <ImageUploadField label="브랜드 로고" value={form.brand_logo_url} onChange={v => setForm(f => ({ ...f, brand_logo_url: v }))} adId={initialAd.id} fieldKey="logo" previewType="logo" />

          {/* map_marker 전용: 위치 선택 */}
          {initialAd.id === 'map_marker' && (
            <div ref={locationFieldRef} className="bg-gray-50 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">광고 마커 위치</span>
              </div>
              <button
                onClick={() => onSelectLocation(initialAd.id)}
                className={cn(
                  'w-full flex items-center gap-3 bg-white rounded-xl px-3 h-11 shadow-sm border active:scale-[0.98] transition-all group',
                  hasLocation ? 'border-rose-200 hover:border-rose-400' : 'border-gray-100 hover:border-violet-300'
                )}
              >
                <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors', hasLocation ? 'bg-rose-100' : 'bg-gray-100 group-hover:bg-violet-100')}>
                  <Navigation2 className={cn('w-3.5 h-3.5', hasLocation ? 'text-rose-500' : 'text-gray-400 group-hover:text-violet-500')} />
                </div>
                <span className={cn('flex-1 text-left text-sm font-medium truncate', hasLocation ? 'text-gray-900' : 'text-gray-400')}>
                  {hasLocation
                    ? (locationLabel ?? `${form.lat!.toFixed(4)}, ${form.lng!.toFixed(4)}`)
                    : '지도에서 위치 선택'}
                </span>
                {hasLocation && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg shrink-0">설정됨</span>}
              </button>
              {hasLocation && <p className="text-[10px] text-gray-400 font-medium mt-1.5 px-1">지도에서 이 위치에 광고 마커가 표시됩니다</p>}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={cn(
              'w-full h-11 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2',
              saved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-violet-600 text-white shadow-lg shadow-violet-100 hover:bg-violet-700 disabled:opacity-50'
            )}
          >
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
              : saved ? <><CheckCircle2 className="w-4 h-4" /> 저장 완료!</>
              : <><Save className="w-4 h-4" /> 변경사항 저장</>}
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
const AdminAds = () => {
  const navigate = useNavigate();
  const [ads, setAds] = useState<AdData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 지도에서 선택한 위치 (sessionStorage에서 읽어온 값)
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapMarkerCardRef = useRef<HTMLDivElement>(null);
  const locationFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ✅ 마운트 시 sessionStorage에서 위치 먼저 읽기 (fetchAds보다 먼저)
    const raw = sessionStorage.getItem('adLocationPending');
    if (raw) {
      sessionStorage.removeItem('adLocationPending');
      try {
        const { lat, lng } = JSON.parse(raw);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setPendingLocation({ lat, lng });
        }
      } catch (e) {
        console.error('[AdminAds] pendingLocation parse error:', e);
      }
    }

    const fetchAds = async () => {
      const { data, error } = await supabase.from('ads').select('*').order('id');
      if (error) {
        showError('광고 데이터를 불러오지 못했습니다.');
        console.error('[AdminAds] fetch error:', error);
      } else {
        const ORDER = ['splash', 'header', 'search', 'trending', 'map_marker'];
        const sorted = [...(data || [])].sort(
          (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)
        ) as AdData[];
        setAds(sorted);
      }
      setIsLoading(false);
    };
    fetchAds();
  }, []);

  // pendingLocation이 설정되면 위치 필드로 스크롤
  useEffect(() => {
    if (!pendingLocation || isLoading) return;
    // 카드 펼침 + 렌더링 완료 후 위치 필드로 스크롤
    setTimeout(() => {
      locationFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  }, [pendingLocation, isLoading]);

  // ✅ ads와 pendingLocation을 합쳐서 최종 렌더용 데이터 생성
  // pendingLocation이 있으면 map_marker의 lat/lng를 덮어씀
  const adsWithPending = ads.map(a =>
    a.id === 'map_marker' && pendingLocation
      ? { ...a, lat: pendingLocation.lat, lng: pendingLocation.lng }
      : a
  );

  const handleSave = async (updated: AdData) => {
    console.log('[AdminAds] saving:', updated.id, 'lat:', updated.lat, 'lng:', updated.lng);

    const { error, data } = await supabase
      .from('ads')
      .update({
        label: updated.label,
        image_url: updated.image_url,
        title: updated.title,
        subtitle: updated.subtitle,
        link_url: updated.link_url,
        brand_name: updated.brand_name,
        brand_logo_url: updated.brand_logo_url,
        is_active: updated.is_active,
        lat: updated.lat ?? null,
        lng: updated.lng ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', updated.id)
      .select();

    console.log('[AdminAds] save result:', { error, rowCount: data?.length, data });

    if (error) {
      showError('저장에 실패했습니다: ' + error.message);
      throw error;
    }
    if (!data || data.length === 0) {
      showError('저장 권한이 없거나 해당 광고를 찾을 수 없습니다.');
      throw new Error('0 rows updated');
    }

    // 저장 성공 시 ads state 업데이트 + pendingLocation 초기화
    setAds(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    if (updated.id === 'map_marker') setPendingLocation(null);
    invalidateAdCache(updated.id, updated);
    showSuccess(`"${updated.label}" 광고가 저장되었습니다! ✨`);
  };

  const handleSelectLocation = (_adId: string) => {
    navigate('/', { state: { startAdLocationSelection: true } });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div
        className="fixed left-0 right-0 z-40 h-14 bg-white flex items-center px-4 border-b border-gray-100"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
      >
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">광고 만들기</h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px + 56px)',
          paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* 히어로 */}
        <div className="mx-4 mt-5 bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-5 text-white shadow-xl shadow-violet-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Tv2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Admin · Ad Manager</p>
              <p className="text-lg font-black leading-tight">앱 광고 통합 관리</p>
            </div>
          </div>
          <p className="text-sm text-white/80 font-medium leading-relaxed mt-3">
            스플래시, 헤더, 검색창, 인기 포스팅, 지도 마커 등 앱 내 모든 광고를 한 곳에서 수정하세요.
          </p>
        </div>

        {/* 광고 카드 목록 */}
        <div className="px-4 pt-5 space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
            광고 구좌 ({adsWithPending.length}개)
          </p>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-3xl animate-pulse border border-gray-100" />
            ))
          ) : (
            adsWithPending.map(ad => (
              <div key={ad.id} ref={ad.id === 'map_marker' ? mapMarkerCardRef : undefined}>
                {/* ✅ key에 lat/lng를 포함 → 위치가 바뀌면 AdCard가 완전히 재마운트되어 initialAd가 새로 적용됨 */}
                <AdCard
                  key={`${ad.id}-${ad.lat ?? 'null'}-${ad.lng ?? 'null'}`}
                  initialAd={ad}
                  defaultExpanded={ad.id === 'map_marker' && pendingLocation != null}
                  locationFieldRef={ad.id === 'map_marker' ? locationFieldRef : undefined}
                  onSave={handleSave}
                  onSelectLocation={handleSelectLocation}
                />
              </div>
            ))
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 font-bold mt-6 mb-4">
          변경사항은 즉시 앱에 반영됩니다
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default AdminAds;
