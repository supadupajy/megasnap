import React, { useState } from 'react';
import { ChevronLeft, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';

const categories = ['계정/로그인', '포스팅', '결제/구독', '버그/오류', '기타'];

const Inquiry = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!category) { showError('문의 유형을 선택해주세요.'); return; }
    if (!title.trim()) { showError('제목을 입력해주세요.'); return; }
    if (content.trim().length < 10) { showError('내용을 10자 이상 입력해주세요.'); return; }
    setSubmitted(true);
    showSuccess('문의가 접수되었습니다. 1~2 영업일 내에 답변드리겠습니다.');
  };

  if (submitted) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
          <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100">
            <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
              <ChevronLeft className="w-6 h-6 text-gray-400" />
            </button>
            <div className="flex-1 flex justify-center -ml-10">
              <h1 className="text-[17px] font-black text-gray-900">1:1 문의</h1>
            </div>
          </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">문의가 접수되었습니다!</h2>
          <p className="text-[13px] text-gray-400 font-medium leading-relaxed mb-8">
            1~2 영업일 내에 이메일로 답변드리겠습니다.<br />
            빠른 처리를 위해 노력하겠습니다.
          </p>
          <button
            onClick={() => { setSubmitted(false); setCategory(''); setTitle(''); setContent(''); }}
            className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm active:scale-95 transition-all"
          >
            새 문의 작성
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="flex-none h-14 bg-white flex items-center px-4 border-b border-gray-100">
        <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1 flex justify-center -ml-10">
          <h1 className="text-[17px] font-black text-gray-900">1:1 문의</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 no-scrollbar">
        <div className="px-4 pt-5 space-y-4">
          {/* 문의 유형 */}
          <div>
            <p className="text-[11px] font-black text-gray-500 mb-2 px-1">문의 유형 *</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    category === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'bg-white text-gray-600 border border-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <p className="text-[11px] font-black text-gray-500 mb-2 px-1">제목 *</p>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="문의 제목을 입력하세요"
              className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm"
            />
          </div>

          {/* 내용 */}
          <div>
            <p className="text-[11px] font-black text-gray-500 mb-2 px-1">내용 *</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={"문의 내용을 자세히 작성해주세요.\n어떤 화면에서, 어떤 동작을 했을 때 문제가 발생했는지 알려주시면 빠른 처리에 도움이 됩니다."}
              rows={7}
              className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-100 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm resize-none"
            />
            <p className="text-[11px] text-gray-300 font-medium mt-1 px-1 text-right">{content.length}자</p>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
          >
            <Send className="w-4 h-4" />
            문의 보내기
          </button>

          <p className="text-center text-[11px] text-gray-300 font-medium">
            답변은 가입하신 이메일로 발송됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Inquiry;