import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Megaphone, Plus, MoreVertical, Trash2, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Notice {
  id: string;
  title: string;
  content: string;
  badge: string;
  badge_color: string;
  created_at: string;
}

const BADGE_OPTIONS = [
  { label: '공지', color: 'bg-blue-100 text-blue-600' },
  { label: '업데이트', color: 'bg-indigo-100 text-indigo-600' },
  { label: '점검', color: 'bg-amber-100 text-amber-600' },
  { label: '정책', color: 'bg-rose-100 text-rose-600' },
  { label: '이벤트', color: 'bg-emerald-100 text-emerald-600' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

const Notices = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 작성 시트
  const [showWrite, setShowWrite] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeBadge, setWriteBadge] = useState(BADGE_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchNotices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setNotices(data as Notice[]);
      if (data.length > 0) setExpanded(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSubmit = async () => {
    if (!writeTitle.trim()) { showError('제목을 입력해주세요.'); return; }
    if (!writeContent.trim()) { showError('내용을 입력해주세요.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('notices').insert({
      title: writeTitle.trim(),
      content: writeContent.trim(),
      badge: writeBadge.label,
      badge_color: writeBadge.color,
    });
    if (error) {
      showError('공지 등록에 실패했습니다.');
    } else {
      showSuccess('공지사항이 등록되었습니다. 📢');
      setShowWrite(false);
      setWriteTitle('');
      setWriteContent('');
      setWriteBadge(BADGE_OPTIONS[0]);
      fetchNotices();
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('notices').delete().eq('id', deleteTarget.id);
    if (error) {
      showError('삭제에 실패했습니다.');
    } else {
      showSuccess('공지사항이 삭제되었습니다.');
      setNotices(prev => prev.filter(n => n.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="h-[calc(100dvh-64px)] mt-16 bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex-none relative z-10 h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/settings'); }}
          className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all cursor-pointer relative z-[110]"
          style={{ pointerEvents: 'auto' }}
        >
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">공지사항</h1>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowWrite(true)}
            className="w-10 h-10 flex items-center justify-center bg-indigo-50 rounded-2xl active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 text-indigo-600" />
          </button>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="px-4 pt-5 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded-full w-1/3" />
                    <div className="h-4 bg-gray-100 rounded-full w-3/4" />
                  </div>
                </div>
              </div>
            ))
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <Megaphone className="w-12 h-12 mb-3" />
              <p className="text-sm font-bold">등록된 공지사항이 없습니다.</p>
            </div>
          ) : (
            notices.map((notice) => (
              <div key={notice.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="flex items-stretch">
                  <button
                    onClick={() => setExpanded(expanded === notice.id ? null : notice.id)}
                    className="flex-1 flex items-center justify-between py-4 px-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Megaphone className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${notice.badge_color}`}>
                            {notice.badge}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">{formatDate(notice.created_at)}</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800 leading-snug">{notice.title}</p>
                      </div>
                    </div>
                    {expanded === notice.id
                      ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                      : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                    }
                  </button>

                  {/* 어드민 쓰리닷 메뉴 */}
                  {isAdmin && (
                    <div className="relative flex items-center pr-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === notice.id ? null : notice.id);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      {openMenuId === notice.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-10 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(notice);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {expanded === notice.id && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-[13px] text-gray-600 font-medium leading-relaxed whitespace-pre-line">
                        {notice.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 공지 작성 바텀시트 */}
      {showWrite && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWrite(false)} />
          <div className="relative bg-white rounded-t-[32px] px-5 pt-5 pb-8 shadow-2xl max-h-[90vh] flex flex-col">
            {/* 핸들 */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {/* 헤더 */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-gray-900">공지사항 작성</h2>
              <button
                onClick={() => setShowWrite(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 active:scale-95 transition-all"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
              {/* 뱃지 선택 */}
              <div>
                <p className="text-[11px] font-black text-gray-500 mb-2 px-0.5">카테고리</p>
                <div className="flex flex-wrap gap-2">
                  {BADGE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setWriteBadge(opt)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                        writeBadge.label === opt.label
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                          : 'border-gray-100 bg-white text-gray-500'
                      }`}
                    >
                      {writeBadge.label === opt.label && <Check className="w-3 h-3" />}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${opt.color}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <p className="text-[11px] font-black text-gray-500 mb-2 px-0.5">제목 *</p>
                <input
                  type="text"
                  value={writeTitle}
                  onChange={e => setWriteTitle(e.target.value)}
                  placeholder="공지 제목을 입력하세요"
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* 내용 */}
              <div>
                <p className="text-[11px] font-black text-gray-500 mb-2 px-0.5">내용 *</p>
                <textarea
                  value={writeContent}
                  onChange={e => setWriteContent(e.target.value)}
                  placeholder="공지 내용을 입력하세요"
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
                />
                <p className="text-[11px] text-gray-300 font-medium mt-1 text-right">{writeContent.length}자</p>
              </div>
            </div>

            {/* 등록 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-4 w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '공지 등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[32px] w-[85%] max-w-[320px] p-6 border-none shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-center text-xl font-black text-gray-900">공지 삭제</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-gray-500 font-medium leading-relaxed">
              <span className="font-black text-gray-700">"{deleteTarget?.title}"</span><br />
              공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 mt-6 sm:justify-center">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-none bg-gray-100 text-gray-900 font-bold hover:bg-gray-200 transition-all m-0">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="flex-1 h-12 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-100 transition-all m-0"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Notices;
