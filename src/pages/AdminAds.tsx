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
  Calendar,
  ArrowRight,
  Clock,
  Sparkles,
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
        resolve([addr.region_1depth_name, addr.region_2depth_name, addr.region_3depth_name].filter(Boolean).join(' '));
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
  start_date?: string | null;
  end_date?: string | null;
  next_image_url?: string | null;
  next_title?: string | null;
  next_subtitle?: string | null;
  next_link_url?: string | null;
  next_brand_name?: string | null;
  next_brand_logo_url?: string | null;
  next_start_date?: string | null;
  next_end_date?: string | null;
}

const AD_ICONS: Record<string, React.ElementType> = {
  splash: Monitor,
  header: Layers,
  search: Search,
  trending: TrendingUp,
  map_marker: MapPin,
};

const AD_COLORS: Record<string, { bg: string; icon: string; border: string; badge: string; accent: string }> = {
  splash:     { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100',    badge: 'bg-blue-100 text-blue-700',    accent: 'bg-blue-600' },
  header:     { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  border: 'border-indigo-100',  badge: 'bg-indigo-100 text-indigo-700',  accent: 'bg-indigo-600' },
  search:     { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700', accent: 'bg-emerald-600' },
  trending:   { bg: 'bg-orange-50',  icon: 'text-orange-600',  border: 'border-orange-100',  badge: 'bg-orange-100 text-orange-700',  accent: 'bg-orange-600' },
  map_marker: { bg: 'bg-rose-50',    icon: 'text-rose-600',    border: 'border-rose-100',    badge: 'bg-rose-100 text-rose-700',    accent: 'bg-rose-600' },
};

const AD_DESCRIPTIONS: Record<string, string> = {
  splash:     '앱 시작 시 스플래시 화면에 표시되는 광고입니다.',
  header:     '지도 화면 상단 헤더 영역의 배너 광고입니다.',
  search:     '친구 검색 화면 상단에 표시되는 배너 광고입니다.',
  trending:   '실시간 인기 포스팅 패널 내 광고 구좌입니다.',
  map_marker: '지도 위에 표시되는 브랜드 마커 광고입니다.',
};

// ─── 날짜+시간 포맷 헬퍼 ─────────────────────────────────────────────────────
// ISO 문자열 → "YYYY-MM-DDTHH:mm" (datetime-local input value 형식)
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  // timestamptz → 로컬 시간 기준 datetime-local 문자열
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local 값 → ISO 문자열 (로컬 시간 → UTC)
function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

// 표시용 포맷: "2025년 4월 28일 오후 3:00"
function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── 날짜+시간 필드 ───────────────────────────────────────────────────────────
const DatetimeRow = ({ label, value, onChange, min }: {
  label: string; value: string; onChange: (isoString: string) => void; min?: string;
}) => (
  <div className="bg-gray-50 rounded-2xl p-3">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Calendar className="w-3 h-3 text-gray-400" />
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <input
      type="datetime-local"
      value={toDatetimeLocal(value)}
      min={min ? toDatetimeLocal(min) : undefined}
      onChange={e => onChange(e.target.value ? fromDatetimeLocal(e.target.value) : '')}
      className="w-full bg-white rounded-xl border border-gray-100 px-3 h-9 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
    />
    {value && (
      <p className="text-[10px] text-gray-400 font-medium mt-1 px-1">{formatDatetime(value)}</p>
    )}
  </div>
);

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

// ─── 텍스트 필드 ─────────────────────────────────────────────────────────────
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

// ─── 기간 상태 뱃지 (시간 단위) ───────────────────────────────────────────────
const PeriodStatusBadge = ({ startDate, endDate, isNext }: { startDate: string; endDate: string; isNext: boolean }) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  let label = '';
  let colorClass = '';

  const formatRemaining = (ms: number): string => {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}분 남음`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `${hours}시간 ${totalMinutes % 60}분 남음`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}일 ${remHours}시간 남음` : `${days}일 남음`;
  };

  const formatUntil = (ms: number): string => {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}분 후 시작`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `${hours}시간 후 시작`;
    const days = Math.floor(hours / 24);
    return `${days}일 후 시작`;
  };

  if (end && end <= now) {
    label = '기간 만료됨';
    colorClass = 'bg-red-50 text-red-600 border-red-100';
  } else if (start && start > now) {
    label = formatUntil(start.getTime() - now.getTime());
    colorClass = 'bg-amber-50 text-amber-600 border-amber-100';
  } else if (end) {
    label = formatRemaining(end.getTime() - now.getTime());
    colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
  } else {
    label = '종료일 미설정';
    colorClass = 'bg-gray-50 text-gray-400 border-gray-100';
  }

  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold', colorClass)}>
      <Clock className="w-3 h-3 shrink-0" />
      <span>{isNext ? '예정 광고 · ' : '현재 광고 · '}{label}</span>
    </div>
  );
};

// ─── 광고 카드 ────────────────────────────────────────────────────────────────
const AdCard = ({
  initialAd,
  savedAd,
  defaultExpanded = false,
  locationFieldRef,
  onSave,
  onSelectLocation,
}: {
  initialAd: AdData;
  savedAd: AdData;
  defaultExpanded?: boolean;
  locationFieldRef?: React.RefObject<HTMLDivElement>;
  onSave: (updated: AdData) => Promise<void>;
  onSelectLocation: (adId: string) => void;
}) => {
  const [form, setForm] = useState<AdData>(initialAd);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  // 현재/다음 탭
  const [activeTab, setActiveTab] = useState<'current' | 'next'>('current');

  const Icon = AD_ICONS[initialAd.id] || Tv2;
  const colors = AD_COLORS[initialAd.id] || AD_COLORS.splash;

  useEffect(() => {
    if (form.lat != null && form.lng != null) {
      setLocationLabel(null);
      reverseGeocode(form.lat, form.lng).then(addr => setLocationLabel(addr));
    } else {
      setLocationLabel(null);
    }
  }, [form.lat, form.lng]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(savedAd);

  const handleChange = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value || null }));
  };

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

  // 현재 슬롯 데이터
  const currentSlot = {
    image_url: form.image_url || '',
    title: form.title || '',
    subtitle: form.subtitle || '',
    link_url: form.link_url || '',
    brand_name: form.brand_name || '',
    brand_logo_url: form.brand_logo_url || '',
    start_date: form.start_date || '',
    end_date: form.end_date || '',
  };

  // 다음 슬롯 데이터
  const nextSlot = {
    image_url: form.next_image_url || '',
    title: form.next_title || '',
    subtitle: form.next_subtitle || '',
    link_url: form.next_link_url || '',
    brand_name: form.next_brand_name || '',
    brand_logo_url: form.next_brand_logo_url || '',
    start_date: form.next_start_date || '',
    end_date: form.next_end_date || '',
  };

  const hasNextAd = !!form.next_image_url;

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
            {hasNextAd && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 shrink-0 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />예정
              </span>
            )}
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
          {initialAd.id === 'map_marker' && (
            <div className="px-4 pb-3 space-y-2">
              {hasLocation && (
                <button
                  onClick={e => { e.stopPropagation(); onSelectLocation(initialAd.id); }}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 h-11 border bg-rose-50 border-rose-100 hover:border-rose-300 transition-all active:scale-[0.98]"
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-rose-100">
                    <Navigation2 className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <span className="flex-1 text-left text-sm font-semibold truncate text-gray-900">
                    {locationLabel ?? `${form.lat!.toFixed(4)}, ${form.lng!.toFixed(4)}`}
                  </span>
                  <span className="text-[10px] font-black text-rose-500 bg-rose-100 px-2 py-0.5 rounded-lg shrink-0">설정됨</span>
                </button>
              )}
              {form.image_url && (
                <div className="w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
          )}
          {initialAd.id !== 'map_marker' && (
            <div className="px-4 pb-3 space-y-2">
              {/* 현재 광고 미리보기 */}
              {form.image_url && (
                <div className="relative w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full">현재</div>
                  {form.end_date && (
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDatetime(form.end_date)}까지
                    </div>
                  )}
                </div>
              )}
              {/* 다음 광고 미리보기 */}
              {form.next_image_url && (
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <div className="relative flex-1 h-14 rounded-xl overflow-hidden bg-gray-100">
                    <img src={form.next_image_url} alt="next preview" className="w-full h-full object-cover opacity-80" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="absolute top-1.5 left-1.5 bg-violet-600/80 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full">다음 예정</div>
                    {form.next_start_date && (
                      <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDatetime(form.next_start_date)}부터
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 편집 폼 */}
      {isExpanded && (
        <div className="border-t border-gray-50">
          {/* 탭 — map_marker는 단일 슬롯이므로 탭 없음 */}
          {initialAd.id !== 'map_marker' && (
            <div className="flex px-4 pt-3 gap-2">
              <button
                onClick={() => setActiveTab('current')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black transition-all',
                  activeTab === 'current'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                현재 광고
              </button>
              <button
                onClick={() => setActiveTab('next')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black transition-all',
                  activeTab === 'next'
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                다음 예정
              </button>
            </div>
          )}

          <div className="px-4 pb-4 pt-3 space-y-3">
            {/* map_marker: 위치 + 단일 슬롯 (기간 설정 없음) */}
            {initialAd.id === 'map_marker' ? (
              <>
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
                      {hasLocation ? (locationLabel ?? `${form.lat!.toFixed(4)}, ${form.lng!.toFixed(4)}`) : '지도에서 위치 선택'}
                    </span>
                    {hasLocation && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-lg shrink-0">설정됨</span>}
                  </button>
                </div>
                {/* 기간 설정 */}
                <div className="grid grid-cols-2 gap-2">
                  <DatetimeRow
                    label="시작 일시"
                    value={form.start_date || ''}
                    onChange={v => handleChange('start_date', v)}
                  />
                  <DatetimeRow
                    label="종료 일시"
                    value={form.end_date || ''}
                    min={form.start_date || undefined}
                    onChange={v => handleChange('end_date', v)}
                  />
                </div>
                {(form.start_date || form.end_date) && (
                  <PeriodStatusBadge startDate={form.start_date || ''} endDate={form.end_date || ''} isNext={false} />
                )}
                <FieldRow icon={Type} label="브랜드명" value={form.brand_name || ''} placeholder="브랜드 이름" onChange={v => handleChange('brand_name', v)} />
                <FieldRow icon={Type} label="설명" value={form.title || ''} placeholder="광고 설명 문구" onChange={v => handleChange('title', v)} />
                <FieldRow icon={Link} label="랜딩 URL" value={form.link_url || ''} placeholder="https://example.com" onChange={v => handleChange('link_url', v)} />
                <ImageUploadField label="배너 이미지" value={form.image_url || ''} onChange={v => handleChange('image_url', v)} adId={initialAd.id} fieldKey="banner" previewType="banner" />
                <ImageUploadField label="브랜드 로고" value={form.brand_logo_url || ''} onChange={v => handleChange('brand_logo_url', v)} adId={initialAd.id} fieldKey="logo" previewType="logo" />
              </>
            ) : activeTab === 'current' ? (
              <AdSlotForm
                slot={currentSlot}
                adId={initialAd.id}
                fieldPrefix=""
                accentColor={colors.accent}
                onChange={handleChange}
              />
            ) : (
              <>
                <div className="bg-violet-50 rounded-2xl p-3 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-black text-violet-700">다음 예정 광고</p>
                    <p className="text-[10px] text-violet-500 font-medium mt-0.5 leading-relaxed">
                      현재 광고 종료 일시가 지나면 자동으로 이 광고로 전환됩니다.
                    </p>
                  </div>
                </div>
                <AdSlotForm
                  slot={nextSlot}
                  adId={initialAd.id}
                  fieldPrefix="next_"
                  accentColor="bg-violet-600"
                  onChange={handleChange}
                />
                {hasNextAd && (
                  <button
                    onClick={() => setForm(f => ({
                      ...f,
                      next_image_url: null, next_title: null, next_subtitle: null,
                      next_link_url: null, next_brand_name: null, next_brand_logo_url: null,
                      next_start_date: null, next_end_date: null,
                    }))}
                    className="w-full py-2.5 rounded-2xl text-[11px] font-black text-red-400 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    다음 광고 초기화
                  </button>
                )}
              </>
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
        </div>
      )}
    </div>
  );
};

// ─── 광고 슬롯 폼 (현재 or 다음) ─────────────────────────────────────────────
const AdSlotForm = ({
  slot,
  adId,
  fieldPrefix,
  accentColor,
  onChange,
}: {
  slot: {
    image_url: string;
    title: string;
    subtitle: string;
    link_url: string;
    brand_name: string;
    brand_logo_url: string;
    start_date: string;
    end_date: string;
  };
  adId: string;
  fieldPrefix: string;
  accentColor: string;
  onChange: (key: string, value: string) => void;
}) => {
  const isNext = fieldPrefix === 'next_';
  return (
    <div className="space-y-2.5">
      {/* 기간 설정 */}
      <div className="grid grid-cols-2 gap-2">
        <DatetimeRow
          label="시작 일시"
          value={slot.start_date}
          onChange={v => onChange(`${fieldPrefix}start_date`, v)}
        />
        <DatetimeRow
          label="종료 일시"
          value={slot.end_date}
          min={slot.start_date || undefined}
          onChange={v => onChange(`${fieldPrefix}end_date`, v)}
        />
      </div>

      {/* 기간 상태 뱃지 */}
      {(slot.start_date || slot.end_date) && (
        <PeriodStatusBadge startDate={slot.start_date} endDate={slot.end_date} isNext={isNext} />
      )}

      <FieldRow icon={Type} label="브랜드명" value={slot.brand_name} placeholder="브랜드 이름" onChange={v => onChange(`${fieldPrefix}brand_name`, v)} />
      <FieldRow icon={Type} label="설명" value={slot.title} placeholder="광고 설명 문구" onChange={v => onChange(`${fieldPrefix}title`, v)} />
      {adId !== 'map_marker' && (
        <FieldRow icon={Type} label="부제목" value={slot.subtitle} placeholder="광고 부제목" onChange={v => onChange(`${fieldPrefix}subtitle`, v)} />
      )}
      <FieldRow icon={Link} label="랜딩 URL" value={slot.link_url} placeholder="https://example.com" onChange={v => onChange(`${fieldPrefix}link_url`, v)} />
      <ImageUploadField label="배너 이미지" value={slot.image_url} onChange={v => onChange(`${fieldPrefix}image_url`, v)} adId={adId} fieldKey={`${fieldPrefix}banner`} previewType="banner" />
      <ImageUploadField label="브랜드 로고" value={slot.brand_logo_url} onChange={v => onChange(`${fieldPrefix}brand_logo_url`, v)} adId={adId} fieldKey={`${fieldPrefix}logo`} previewType="logo" />
    </div>
  );
};

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
const AdminAds = () => {
  const navigate = useNavigate();
  const [ads, setAds] = useState<AdData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapMarkerCardRef = useRef<HTMLDivElement>(null);
  const locationFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (!pendingLocation || isLoading) return;
    setTimeout(() => {
      locationFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  }, [pendingLocation, isLoading]);

  const adsWithPending = ads.map(a =>
    a.id === 'map_marker' && pendingLocation
      ? { ...a, lat: pendingLocation.lat, lng: pendingLocation.lng }
      : a
  );

  const handleSave = async (updated: AdData) => {
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
        start_date: updated.start_date ?? null,
        end_date: updated.end_date ?? null,
        next_image_url: updated.next_image_url ?? null,
        next_title: updated.next_title ?? null,
        next_subtitle: updated.next_subtitle ?? null,
        next_link_url: updated.next_link_url ?? null,
        next_brand_name: updated.next_brand_name ?? null,
        next_brand_logo_url: updated.next_brand_logo_url ?? null,
        next_start_date: updated.next_start_date ?? null,
        next_end_date: updated.next_end_date ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', updated.id)
      .select();

    if (error) {
      showError('저장에 실패했습니다: ' + error.message);
      throw error;
    }
    if (!data || data.length === 0) {
      showError('저장 권한이 없거나 해당 광고를 찾을 수 없습니다.');
      throw new Error('0 rows updated');
    }

    setAds(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    if (updated.id === 'map_marker') setPendingLocation(null);
    invalidateAdCache(updated.id, updated);
    showSuccess(`"${updated.label}" 광고가 저장되었습니다! ✨`);

    if (updated.id === 'map_marker' && updated.lat != null && updated.lng != null) {
      setTimeout(() => {
        navigate('/', { state: { center: { lat: updated.lat, lng: updated.lng }, adMarkerSaved: true } });
      }, 800);
    }
  };

  const handleSelectLocation = (_adId: string) => {
    navigate('/', { state: { startAdLocationSelection: true } });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div
        className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100"
        style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
      >
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer z-[100] relative"
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">광고 만들기</h1>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
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
            각 광고 구좌마다 <span className="text-white font-black">현재 광고</span>와 <span className="text-white font-black">다음 예정 광고</span>를 설정하고, 기간이 끝나면 자동으로 전환됩니다.
          </p>
          {/* 자동 전환 흐름 설명 */}
          <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-2xl px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
              <Eye className="w-3 h-3" />현재 광고
            </div>
            <ArrowRight className="w-3 h-3 text-white/50" />
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
              <Calendar className="w-3 h-3" />종료일 도달
            </div>
            <ArrowRight className="w-3 h-3 text-white/50" />
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white">
              <Sparkles className="w-3 h-3" />다음 광고 자동 전환
            </div>
          </div>
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
                <AdCard
                  key={`${ad.id}-${ad.lat ?? 'null'}-${ad.lng ?? 'null'}`}
                  initialAd={ad}
                  savedAd={ads.find(a => a.id === ad.id) ?? ad}
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