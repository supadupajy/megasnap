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
  Plus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { loadKakaoMapsSdk } from '@/utils/kakao-maps';
import { resolveOfflineLocationName } from '@/utils/offline-location';
import { formatAdministrativeAddress, getCachedLocationName, setCachedLocationName } from '@/utils/location-format';

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  // 동일 좌표는 세션 내 1회만 카카오 Geocoder를 호출한다.
  const cached = getCachedLocationName(lat, lng);
  if (cached) return cached;

  try {
    await loadKakaoMapsSdk();
  } catch (e) {
    return resolveOfflineLocationName(lat, lng);
  }

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
        const name = formatAdministrativeAddress(
          addr.region_1depth_name,
          addr.region_2depth_name,
          addr.region_3depth_name
        );
        setCachedLocationName(lat, lng, name);
        resolve(name);
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
  ad_type?: string | null;
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
  trending:   '실시간 인기 컨텐츠 패널 내 광고 구좌입니다.',
  map_marker: '지도 위에 표시되는 브랜드 마커 광고입니다.',
};

// ─── 날짜+시간 포맷 헬퍼 ─────────────────────────────────────────────────────
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  return new Date(val).toISOString();
}

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
      className="w-full bg-white rounded-xl border border-gray-100 px-2 h-9 text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
      style={{ minWidth: 0 }}
    />
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

// ─── 기간 상태 뱃지 ───────────────────────────────────────────────────────────
const PeriodStatusBadge = ({ startDate, endDate, isNext, onReset }: { startDate: string; endDate: string; isNext: boolean; onReset?: () => void }) => {
  const now = new Date();
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  const formatUntilStart = (ms: number): string => {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}분 후 시작 예정`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `${hours}시간 후 시작 예정`;
    const days = Math.floor(hours / 24);
    return `${days}일 후 시작 예정`;
  };

  const formatRemaining = (ms: number): string => {
    const totalMinutes = Math.ceil(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}분 남았음`;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `${hours}시간 ${totalMinutes % 60}분 남았음`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}일 ${remHours}시간 남았음` : `${days}일 남았음`;
  };

  const isExpired = !!(end && end <= now);
  const isNotStarted = !!(start && start > now);
  const isRunning = !isExpired && !isNotStarted && !!(start || end);

  let leftLabel = '';
  let rightLabel = '';
  let colorClass = '';

  if (isExpired) {
    leftLabel = '기간 만료됨';
    colorClass = 'bg-red-50 text-red-600 border-red-100';
  } else if (isNotStarted) {
    leftLabel = formatUntilStart(start!.getTime() - now.getTime());
    colorClass = 'bg-amber-50 text-amber-600 border-amber-100';
  } else if (isRunning) {
    leftLabel = '진행 중';
    rightLabel = end ? formatRemaining(end.getTime() - now.getTime()) : '';
    colorClass = 'bg-emerald-50 text-emerald-600 border-emerald-100';
  } else {
    leftLabel = '종료일 미설정';
    colorClass = 'bg-gray-50 text-gray-400 border-gray-100';
  }

  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold', colorClass)}>
      <Clock className="w-3 h-3 shrink-0" />
      <span className="flex-1">{leftLabel}</span>
      {rightLabel && <span className="shrink-0 text-[11px] font-black">{rightLabel}</span>}
      {isExpired && !isNext && onReset && (
        <button
          onClick={e => { e.stopPropagation(); onReset(); }}
          className="ml-1 shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-[10px] font-black transition-colors"
        >
          <X className="w-3 h-3" />
          데이터 초기화
        </button>
      )}
    </div>
  );
};

// ─── 광고 슬롯 폼 (현재 or 다음) ─────────────────────────────────────────────
const AdSlotForm = ({
  slot, adId, fieldPrefix, onChange, onReset,
}: {
  slot: { image_url: string; title: string; subtitle: string; link_url: string; brand_name: string; brand_logo_url: string; start_date: string; end_date: string; };
  adId: string; fieldPrefix: string;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
}) => {
  const isNext = fieldPrefix === 'next_';
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2">
        <DatetimeRow label="시작 일시" value={slot.start_date} onChange={v => onChange(`${fieldPrefix}start_date`, v)} />
        <DatetimeRow label="종료 일시" value={slot.end_date} min={slot.start_date || undefined} onChange={v => onChange(`${fieldPrefix}end_date`, v)} />
      </div>
      {(slot.start_date || slot.end_date) && (
        <PeriodStatusBadge startDate={slot.start_date} endDate={slot.end_date} isNext={isNext} onReset={!isNext ? onReset : undefined} />
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

// ─── 지도 마커 광고 카드 (여러 개 지원) ──────────────────────────────────────
const MapMarkerAdCard = ({
  ad,
  index,
  pendingLocation,
  locationFieldRef,
  onSave,
  onDelete,
  onSelectLocation,
  defaultExpanded,
}: {
  ad: AdData;
  index: number;
  pendingLocation: { lat: number; lng: number } | null;
  locationFieldRef?: React.RefObject<HTMLDivElement>;
  onSave: (updated: AdData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectLocation: (adId: string) => void;
  defaultExpanded?: boolean;
}) => {
  const effectiveAd = pendingLocation ? { ...ad, lat: pendingLocation.lat, lng: pendingLocation.lng } : ad;
  const [form, setForm] = useState<AdData>(effectiveAd);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (pendingLocation) {
      setForm(f => ({ ...f, lat: pendingLocation.lat, lng: pendingLocation.lng }));
    }
  }, [pendingLocation]);

  useEffect(() => {
    if (form.lat != null && form.lng != null) {
      setLocationLabel(null);
      reverseGeocode(form.lat, form.lng).then(addr => setLocationLabel(addr));
    } else {
      setLocationLabel(null);
    }
  }, [form.lat, form.lng]);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(effectiveAd);
  const hasLocation = form.lat != null && form.lng != null;

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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(ad.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // 현재 광고 상태 계산
  const now = new Date();
  const startDate = form.start_date ? new Date(form.start_date) : null;
  const endDate = form.end_date ? new Date(form.end_date) : null;
  const isPending = !!(startDate && startDate > now);
  const isExpiredAd = !!(endDate && endDate <= now);
  const isActive = !isPending && !isExpiredAd && form.is_active;

  return (
    <div className="rounded-3xl border border-rose-100 overflow-hidden shadow-sm bg-white">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50 transition-colors" onClick={() => setIsExpanded(v => !v)}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-rose-50">
          <MapPin className="w-5 h-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[13px] font-black text-gray-900" style={{ letterSpacing: '-0.04em' }}>
              지도 마커 광고 #{index + 1}
            </p>
            {isPending && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 shrink-0">준비중</span>
            )}
            {isExpiredAd && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 shrink-0">만료됨</span>
            )}
            {isActive && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0">진행중</span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-medium truncate">
            {hasLocation ? (locationLabel ?? `${form.lat!.toFixed(4)}, ${form.lng!.toFixed(4)}`) : '위치 미설정'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </div>

      {/* 접힌 상태 미리보기 */}
      {!isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {form.image_url && (() => {
            const isExpiredPreview = form.end_date ? new Date(form.end_date) <= new Date() : false;
            const remainingPreview = (() => {
              if (!form.end_date) return null;
              const end = new Date(form.end_date);
              const now = new Date();
              if (end <= now) return null;
              const ms = end.getTime() - now.getTime();
              const totalMinutes = Math.ceil(ms / 60000);
              if (totalMinutes < 60) return `${totalMinutes}분 남음`;
              const hours = Math.floor(totalMinutes / 60);
              if (hours < 24) return `${hours}시간 ${totalMinutes % 60}분 남음`;
              const days = Math.floor(hours / 24);
              const remHours = hours % 24;
              return remHours > 0 ? `${days}일 ${remHours}시간 남음` : `${days}일 남음`;
            })();
            return (
              <div className="relative w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full">현재</div>
                {form.end_date && (
                  <div className={cn('absolute top-2 right-2 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', isExpiredPreview ? 'bg-red-500/80' : 'bg-black/50')}>
                    <Calendar className="w-2.5 h-2.5" />
                    {isExpiredPreview ? '기간 만료됨' : remainingPreview ? remainingPreview : `${formatDatetime(form.end_date)}까지`}
                  </div>
                )}
              </div>
            );
          })()}
          {hasLocation && (
            <button
              onClick={e => { e.stopPropagation(); onSelectLocation(ad.id); }}
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
        </div>
      )}

      {/* 편집 폼 */}
      {isExpanded && (
        <div className="border-t border-gray-50">
          <div className="px-4 pb-4 pt-3 space-y-3">
            {/* 위치 선택 */}
            <div ref={locationFieldRef} className="bg-gray-50 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">광고 마커 위치</span>
              </div>
              <button
                onClick={() => onSelectLocation(ad.id)}
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
            <div className="flex flex-col gap-2">
              <DatetimeRow label="시작 일시" value={form.start_date || ''} onChange={v => handleChange('start_date', v)} />
              <DatetimeRow label="종료 일시" value={form.end_date || ''} min={form.start_date || undefined} onChange={v => handleChange('end_date', v)} />
            </div>
            {(form.start_date || form.end_date) && (
              <PeriodStatusBadge startDate={form.start_date || ''} endDate={form.end_date || ''} isNext={false} />
            )}

            <FieldRow icon={Type} label="브랜드명" value={form.brand_name || ''} placeholder="브랜드 이름" onChange={v => handleChange('brand_name', v)} />
            <FieldRow icon={Type} label="설명" value={form.title || ''} placeholder="광고 설명 문구" onChange={v => handleChange('title', v)} />
            <FieldRow icon={Link} label="랜딩 URL" value={form.link_url || ''} placeholder="https://example.com" onChange={v => handleChange('link_url', v)} />
            <ImageUploadField label="배너 이미지" value={form.image_url || ''} onChange={v => handleChange('image_url', v)} adId={ad.id} fieldKey="banner" previewType="banner" />
            <ImageUploadField label="브랜드 로고" value={form.brand_logo_url || ''} onChange={v => handleChange('brand_logo_url', v)} adId={ad.id} fieldKey="logo" previewType="logo" />

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

            {/* 삭제 버튼 */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 rounded-2xl text-[11px] font-black text-red-400 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                이 마커 광고 삭제
              </button>
            ) : (
              <div className="bg-red-50 rounded-2xl p-3 space-y-2">
                <p className="text-[11px] font-black text-red-600 text-center">정말 삭제하시겠습니까?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-black text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 py-2 rounded-xl text-[11px] font-black text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 일반 광고 카드 (splash, header, search, trending) ────────────────────────
const AdCard = ({
  initialAd, savedAd, defaultExpanded = false, onSave, onSelectLocation,
}: {
  initialAd: AdData; savedAd: AdData; defaultExpanded?: boolean;
  onSave: (updated: AdData) => Promise<void>;
  onSelectLocation: (adId: string) => void;
}) => {
  const [form, setForm] = useState<AdData>(initialAd);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'next'>('current');

  useEffect(() => {
    const nextStart = form.next_start_date ? new Date(form.next_start_date) : null;
    if (!nextStart || !form.next_image_url) return;
    const now = new Date();
    if (nextStart <= now) {
      setForm(f => ({
        ...f,
        image_url: f.next_image_url ?? f.image_url,
        title: f.next_title ?? f.title,
        subtitle: f.next_subtitle ?? f.subtitle,
        link_url: f.next_link_url ?? f.link_url,
        brand_name: f.next_brand_name ?? f.brand_name,
        brand_logo_url: f.next_brand_logo_url ?? f.brand_logo_url,
        start_date: f.next_start_date ?? f.start_date,
        end_date: f.next_end_date ?? f.end_date,
        next_image_url: null, next_title: null, next_subtitle: null,
        next_link_url: null, next_brand_name: null, next_brand_logo_url: null,
        next_start_date: null, next_end_date: null,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(savedAd);
  const handleChange = (key: string, value: string) => setForm(f => ({ ...f, [key]: value || null }));
  const handleResetCurrentSlot = () => setForm(f => ({ ...f, image_url: '', title: '', subtitle: '', link_url: '', brand_name: '', brand_logo_url: '', start_date: null, end_date: null }));

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

  const Icon = AD_ICONS[initialAd.id] || Tv2;
  const colors = AD_COLORS[initialAd.id] || AD_COLORS.splash;
  const hasNextAd = !!form.next_image_url;

  const currentSlot = { image_url: form.image_url || '', title: form.title || '', subtitle: form.subtitle || '', link_url: form.link_url || '', brand_name: form.brand_name || '', brand_logo_url: form.brand_logo_url || '', start_date: form.start_date || '', end_date: form.end_date || '' };
  const nextSlot = { image_url: form.next_image_url || '', title: form.next_title || '', subtitle: form.next_subtitle || '', link_url: form.next_link_url || '', brand_name: form.next_brand_name || '', brand_logo_url: form.next_brand_logo_url || '', start_date: form.next_start_date || '', end_date: form.next_end_date || '' };

  return (
    <div className={cn('rounded-3xl border overflow-hidden shadow-sm', colors.border, 'bg-white')}>
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

      {!isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {form.image_url && (() => {
            const isExpiredAd = form.end_date ? new Date(form.end_date) <= new Date() : false;
            const remaining = (() => {
              if (!form.end_date) return null;
              const end = new Date(form.end_date);
              const now = new Date();
              if (end <= now) return null;
              const ms = end.getTime() - now.getTime();
              const totalMinutes = Math.ceil(ms / 60000);
              if (totalMinutes < 60) return `${totalMinutes}분 남음`;
              const hours = Math.floor(totalMinutes / 60);
              if (hours < 24) return `${hours}시간 ${totalMinutes % 60}분 남음`;
              const days = Math.floor(hours / 24);
              const remHours = hours % 24;
              return remHours > 0 ? `${days}일 ${remHours}시간 남음` : `${days}일 남음`;
            })();
            return (
              <div className="relative w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
                <img src={form.image_url} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full">현재</div>
                {form.end_date && (
                  <div className={cn('absolute top-2 right-2 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', isExpiredAd ? 'bg-red-500/80' : 'bg-black/50')}>
                    <Calendar className="w-2.5 h-2.5" />
                    {isExpiredAd ? '기간 만료됨' : remaining ? `${remaining}` : `${formatDatetime(form.end_date)}까지`}
                  </div>
                )}
              </div>
            );
          })()}
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

      {isExpanded && (
        <div className="border-t border-gray-50">
          <div className="flex px-4 pt-3 gap-2">
            <button onClick={() => setActiveTab('current')} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black transition-all', activeTab === 'current' ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
              <Eye className="w-3.5 h-3.5" />현재 광고
            </button>
            <button onClick={() => setActiveTab('next')} className={cn('flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-black transition-all', activeTab === 'next' ? 'bg-violet-600 text-white shadow-sm shadow-violet-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
              <Sparkles className="w-3.5 h-3.5" />다음 예정
            </button>
          </div>
          <div className="px-4 pb-4 pt-3 space-y-3">
            {activeTab === 'current' ? (
              <AdSlotForm slot={currentSlot} adId={initialAd.id} fieldPrefix="" onChange={handleChange} onReset={handleResetCurrentSlot} />
            ) : (
              <>
                <div className="bg-violet-50 rounded-2xl p-3 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-black text-violet-700">다음 예정 광고</p>
                    <p className="text-[10px] text-violet-500 font-medium mt-0.5 leading-relaxed">현재 광고 종료 일시가 지나면 자동으로 이 광고로 전환됩니다.</p>
                  </div>
                </div>
                <AdSlotForm slot={nextSlot} adId={initialAd.id} fieldPrefix="next_" onChange={handleChange} />
                {hasNextAd && (
                  <button
                    onClick={() => setForm(f => ({ ...f, next_image_url: null, next_title: null, next_subtitle: null, next_link_url: null, next_brand_name: null, next_brand_logo_url: null, next_start_date: null, next_end_date: null }))}
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
              className={cn('w-full h-11 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2', saved ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-violet-600 text-white shadow-lg shadow-violet-100 hover:bg-violet-700 disabled:opacity-50')}
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

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
const AdminAds = () => {
  const navigate = useNavigate();
  // 일반 광고 (splash, header, search, trending)
  const [regularAds, setRegularAds] = useState<AdData[]>([]);
  // 지도 마커 광고 (여러 개)
  const [mapMarkerAds, setMapMarkerAds] = useState<AdData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMarker, setIsCreatingMarker] = useState(false);
  // pendingLocation: { adId, lat, lng } — 위치 선택 후 돌아왔을 때 어떤 마커에 적용할지
  const [pendingLocation, setPendingLocation] = useState<{ adId: string; lat: number; lng: number } | null>(null);
  const locationFieldRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());

  const getLocationFieldRef = (adId: string) => {
    if (!locationFieldRefs.current.has(adId)) {
      locationFieldRefs.current.set(adId, React.createRef<HTMLDivElement>());
    }
    return locationFieldRefs.current.get(adId)!;
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('adLocationPending');
    if (raw) {
      sessionStorage.removeItem('adLocationPending');
      try {
        const { lat, lng, adId } = JSON.parse(raw);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setPendingLocation({ adId: adId || 'new', lat, lng });
        }
      } catch (e) {
        console.error('[AdminAds] pendingLocation parse error:', e);
      }
    }

    const fetchAds = async () => {
      const { data, error } = await supabase.from('ads').select('*');
      if (error) {
        showError('광고 데이터를 불러오지 못했습니다.');
      } else {
        const allAds = (data || []) as AdData[];
        const ORDER = ['splash', 'header', 'search', 'trending'];
        const regular = allAds
          .filter(a => !a.ad_type || a.ad_type !== 'map_marker')
          .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
        const markers = allAds.filter(a => a.ad_type === 'map_marker');
        setRegularAds(regular);
        setMapMarkerAds(markers);
      }
      setIsLoading(false);
    };
    fetchAds();
  }, []);

  useEffect(() => {
    if (!pendingLocation || isLoading) return;
    const { adId } = pendingLocation;
    setTimeout(() => {
      const ref = locationFieldRefs.current.get(adId);
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  }, [pendingLocation, isLoading]);

  // 새 지도 마커 광고 생성
  const handleCreateMapMarker = async () => {
    setIsCreatingMarker(true);
    try {
      const newId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('ads')
        .insert({
          id: newId,
          label: '지도 마커 광고',
          image_url: null,
          title: null,
          subtitle: null,
          link_url: null,
          brand_name: null,
          brand_logo_url: null,
          is_active: false,
          ad_type: 'map_marker',
          lat: null,
          lng: null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        showError('마커 광고 생성에 실패했습니다: ' + error.message);
        return;
      }
      setMapMarkerAds(prev => [...prev, data as AdData]);
      showSuccess('새 지도 마커 광고가 생성되었습니다! 📍');
    } finally {
      setIsCreatingMarker(false);
    }
  };

  // 지도 마커 광고 저장
  const handleSaveMapMarker = async (updated: AdData) => {
    const finalIsActive = !!(updated.image_url && updated.lat != null && updated.lng != null);

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
        is_active: finalIsActive,
        lat: updated.lat ?? null,
        lng: updated.lng ?? null,
        start_date: updated.start_date ?? null,
        end_date: updated.end_date ?? null,
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

    const savedAd = { ...updated, is_active: finalIsActive };
    setMapMarkerAds(prev => prev.map(a => a.id === updated.id ? savedAd : a));
    if (pendingLocation?.adId === updated.id) setPendingLocation(null);
    showSuccess('지도 마커 광고가 저장되었습니다! ✨');

    if (savedAd.lat != null && savedAd.lng != null) {
      setTimeout(() => {
        navigate('/', {
          state: {
            center: { lat: savedAd.lat, lng: savedAd.lng },
            adMarkerSaved: true,
            adMarkerId: `ad-map-marker-${savedAd.id}`,
          },
        });
      }, 800);
    }
  };

  // 지도 마커 광고 삭제
  const handleDeleteMapMarker = async (id: string) => {
    const { error } = await supabase.from('ads').delete().eq('id', id);
    if (error) {
      showError('삭제에 실패했습니다: ' + error.message);
      throw error;
    }
    setMapMarkerAds(prev => prev.filter(a => a.id !== id));
    showSuccess('지도 마커 광고가 삭제되었습니다.');
  };

  // 일반 광고 저장
  const handleSaveRegular = async (updated: AdData) => {
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

    if (error) { showError('저장에 실패했습니다: ' + error.message); throw error; }
    if (!data || data.length === 0) { showError('저장 권한이 없거나 해당 광고를 찾을 수 없습니다.'); throw new Error('0 rows updated'); }

    setRegularAds(prev => prev.map(a => a.id === updated.id ? updated : a));
    showSuccess(`"${updated.label}" 광고가 저장되었습니다! ✨`);
  };

  const handleSelectLocation = (adId: string) => {
    // adId를 sessionStorage에 함께 저장해서 돌아왔을 때 어떤 마커인지 알 수 있게
    sessionStorage.setItem('adLocationTargetId', adId);

    const currentMarker = mapMarkerAds.find(ad => ad.id === adId);
    const initialCenter = currentMarker?.lat != null && currentMarker?.lng != null
      ? { lat: currentMarker.lat, lng: currentMarker.lng }
      : undefined;

    navigate('/', {
      state: {
        startAdLocationSelection: true,
        targetAdId: adId,
        initialCenter,
      },
    });
  };

  const totalAds = regularAds.length + mapMarkerAds.length;

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900 tracking-tight">광고 관리</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
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

        {/* 일반 광고 카드 목록 */}
        <div className="px-4 pt-5 space-y-3">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">
            광고 구좌 ({regularAds.length}개)
          </p>

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-3xl animate-pulse border border-gray-100" />
            ))
          ) : (
            regularAds.map(ad => (
              <AdCard
                key={ad.id}
                initialAd={ad}
                savedAd={ad}
                onSave={handleSaveRegular}
                onSelectLocation={handleSelectLocation}
              />
            ))
          )}
        </div>

        {/* 지도 마커 광고 섹션 */}
        <div className="px-4 pt-6 space-y-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              지도 마커 광고 ({mapMarkerAds.length}개)
            </p>
            <button
              onClick={handleCreateMapMarker}
              disabled={isCreatingMarker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-black shadow-sm shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {isCreatingMarker ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              마커 추가
            </button>
          </div>

          {/* 지도 마커 안내 */}
          <div className="bg-rose-50 rounded-2xl p-3 flex items-start gap-2.5 border border-rose-100">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-black text-rose-700">지도 마커 광고</p>
              <p className="text-[10px] text-rose-500 font-medium mt-0.5 leading-relaxed">
                원하는 만큼 마커를 추가할 수 있습니다. 각 마커는 독립적으로 위치, 기간, 이미지를 설정할 수 있습니다.
              </p>
            </div>
          </div>

          {isLoading ? (
            Array.from({ length: 1 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-3xl animate-pulse border border-gray-100" />
            ))
          ) : mapMarkerAds.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-rose-200 p-8 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-rose-300" />
              </div>
              <p className="text-[12px] font-black text-gray-400">지도 마커 광고가 없습니다</p>
              <p className="text-[10px] text-gray-300 font-medium text-center">위의 "마커 추가" 버튼을 눌러<br />첫 번째 마커 광고를 만들어보세요</p>
            </div>
          ) : (
            mapMarkerAds.map((ad, index) => (
              <MapMarkerAdCard
                key={ad.id}
                ad={ad}
                index={index}
                pendingLocation={pendingLocation?.adId === ad.id ? { lat: pendingLocation.lat, lng: pendingLocation.lng } : null}
                locationFieldRef={getLocationFieldRef(ad.id)}
                onSave={handleSaveMapMarker}
                onDelete={handleDeleteMapMarker}
                onSelectLocation={handleSelectLocation}
                defaultExpanded={pendingLocation?.adId === ad.id}
              />
            ))
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 font-bold mt-6 mb-4">
          변경사항은 즉시 앱에 반영됩니다
        </p>
      </div>
    </div>
  );
};

export default AdminAds;