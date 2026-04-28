import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';

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
}

const AD_ICONS: Record<string, React.ElementType> = {
  splash: Monitor,
  header: Layers,
  search: Search,
  trending: TrendingUp,
  map_marker: MapPin,
};

const AD_COLORS: Record<string, { bg: string; icon: string; border: string; badge: string }> = {
  splash: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-700' },
  header: { bg: 'bg-indigo-50', icon: 'text-indigo-600', border: 'border-indigo-100', badge: 'bg-indigo-100 text-indigo-700' },
  search: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  trending: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100', badge: 'bg-orange-100 text-orange-700' },
  map_marker: { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100', badge: 'bg-rose-100 text-rose-700' },
};

const AD_DESCRIPTIONS: Record<string, string> = {
  splash: '앱 시작 시 스플래시 화면에 표시되는 광고입니다.',
  header: '지도 화면 상단 헤더 영역의 배너 광고입니다.',
  search: '친구 검색 화면 상단에 표시되는 배너 광고입니다.',
  trending: '실시간 인기 포스팅 패널 내 광고 구좌입니다.',
  map_marker: '지도 위에 표시되는 브랜드 마커 광고입니다.',
};

const AdCard = ({
  ad,
  onSave,
}: {
  ad: AdData;
  onSave: (updated: AdData) => Promise<void>;
}) => {
  const [form, setForm] = useState<AdData>(ad);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const Icon = AD_ICONS[ad.id] || Tv2;
  const colors = AD_COLORS[ad.id] || AD_COLORS.splash;
  const hasChanges = JSON.stringify(form) !== JSON.stringify(ad);

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

  const toggleActive = () => setForm(f => ({ ...f, is_active: !f.is_active }));

  return (
    <div className={cn('rounded-3xl border overflow-hidden shadow-sm', colors.border, 'bg-white')}>
      {/* 카드 헤더 */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer active:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', colors.bg)}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-black text-gray-900">{ad.label}</p>
            <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider', colors.badge)}>
              {ad.id}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium truncate">{AD_DESCRIPTIONS[ad.id]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); toggleActive(); }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black transition-all',
              form.is_active
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-400'
            )}
          >
            {form.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {form.is_active ? 'ON' : 'OFF'}
          </button>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-gray-300" />
            : <ChevronDown className="w-4 h-4 text-gray-300" />
          }
        </div>
      </div>

      {/* 이미지 미리보기 */}
      {form.image_url && !isExpanded && (
        <div className="px-4 pb-3">
          <div className="w-full h-20 rounded-2xl overflow-hidden bg-gray-100">
            <img
              src={form.image_url}
              alt="preview"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      {/* 편집 폼 */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
          {/* 이미지 미리보기 */}
          {form.image_url && (
            <div className="w-full h-32 rounded-2xl overflow-hidden bg-gray-100 mb-2">
              <img
                src={form.image_url}
                alt="preview"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          <FieldRow
            icon={Type}
            label="제목"
            value={form.title}
            placeholder="광고 제목"
            onChange={v => setForm(f => ({ ...f, title: v }))}
          />
          <FieldRow
            icon={Type}
            label="부제목"
            value={form.subtitle}
            placeholder="광고 부제목"
            onChange={v => setForm(f => ({ ...f, subtitle: v }))}
          />
          <FieldRow
            icon={Link}
            label="랜딩 URL"
            value={form.link_url}
            placeholder="https://example.com"
            onChange={v => setForm(f => ({ ...f, link_url: v }))}
          />
          <FieldRow
            icon={Type}
            label="브랜드명"
            value={form.brand_name}
            placeholder="브랜드 이름"
            onChange={v => setForm(f => ({ ...f, brand_name: v }))}
          />
          <FieldRow
            icon={Image}
            label="이미지"
            value={form.image_url}
            placeholder="https://example.com/image.jpg"
            onChange={v => setForm(f => ({ ...f, image_url: v }))}
          />
          <FieldRow
            icon={Image}
            label="브랜드 로고"
            value={form.brand_logo_url}
            placeholder="https://example.com/logo.svg"
            onChange={v => setForm(f => ({ ...f, brand_logo_url: v }))}
          />

          <Button
            onClick={handleSave}
            disabled={isSaving || (!hasChanges && form.is_active === ad.is_active)}
            className={cn(
              'w-full h-11 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2',
              saved
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                : 'bg-violet-600 text-white shadow-lg shadow-violet-100 hover:bg-violet-700 disabled:opacity-50'
            )}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" /> 저장 완료!</>
            ) : (
              <><Save className="w-4 h-4" /> 변경사항 저장</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

const FieldRow = ({
  icon: Icon,
  label,
  value,
  placeholder,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) => (
  <div className="bg-gray-50 rounded-2xl p-3">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3 h-3 text-gray-400" />
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="border-none bg-white rounded-xl focus-visible:ring-violet-300 font-medium text-sm h-9 shadow-sm"
    />
  </div>
);

const AdminAds = () => {
  const navigate = useNavigate();
  const [ads, setAds] = useState<AdData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAds = async () => {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('id');
      if (error) {
        showError('광고 데이터를 불러오지 못했습니다.');
        console.error('[AdminAds] fetch error:', error);
      } else {
        // 원하는 순서로 정렬
        const ORDER = ['splash', 'header', 'search', 'trending', 'map_marker'];
        const sorted = [...(data || [])].sort(
          (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)
        );
        setAds(sorted as AdData[]);
      }
      setIsLoading(false);
    };
    fetchAds();
  }, []);

  const handleSave = async (updated: AdData) => {
    const { error } = await supabase
      .from('ads')
      .upsert({
        id: updated.id,
        label: updated.label,
        image_url: updated.image_url,
        title: updated.title,
        subtitle: updated.subtitle,
        link_url: updated.link_url,
        brand_name: updated.brand_name,
        brand_logo_url: updated.brand_logo_url,
        is_active: updated.is_active,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      showError('저장에 실패했습니다: ' + error.message);
      throw error;
    }

    setAds(prev => prev.map(a => (a.id === updated.id ? updated : a)));
    showSuccess(`"${updated.label}" 광고가 저장되었습니다! ✨`);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100 mt-16">
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

      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
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
            광고 구좌 ({ads.length}개)
          </p>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-3xl animate-pulse border border-gray-100" />
            ))
          ) : (
            ads.map(ad => (
              <AdCard key={ad.id} ad={ad} onSave={handleSave} />
            ))
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 font-bold mt-6 mb-2">
          변경사항은 즉시 앱에 반영됩니다
        </p>
      </div>

      <BottomNav />
    </div>
  );
};

export default AdminAds;
