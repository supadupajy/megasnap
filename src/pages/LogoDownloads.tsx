import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type LogoItem = {
  title: string;
  description: string;
  previewPath: string;
  downloadPath: string;
  downloadFileName: string;
  badge: string;
  cropped?: boolean;
};

const LOGOS: LogoItem[] = [
  {
    title: '앱 아이콘',
    description: '현재 앱에 적용된 크롭 버전 아이콘',
    previewPath: '/hi-bubble-icon.png',
    downloadPath: '/hi-bubble-icon.png',
    downloadFileName: 'hi-bubble-icon.png',
    badge: 'PNG',
    cropped: true,
  },
  {
    title: '워드마크',
    description: '텍스트 로고 원본 SVG',
    previewPath: '/hi-bubble-wordmark.svg',
    downloadPath: '/hi-bubble-wordmark.svg',
    downloadFileName: 'hi-bubble-wordmark.svg',
    badge: 'SVG',
  },
  {
    title: '조합 로고',
    description: '비눗방울 아이콘 + 워드마크 조합',
    previewPath: '/hi-bubble-logo.svg',
    downloadPath: '/hi-bubble-logo.svg',
    downloadFileName: 'hi-bubble-logo.svg',
    badge: 'SVG',
  },
];

const LogoDownloads = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-6">
        <div className="mb-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-black/5 active:scale-95"
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">로고 다운로드</h1>
            <p className="mt-1 text-sm text-slate-500">현재 적용된 비눗방울 로고를 그대로 다운로드할 수 있어요.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {LOGOS.map((item) => (
            <div
              key={item.downloadFileName}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]"
            >
              <div
                className="flex h-44 items-center justify-center rounded-2xl"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg,#f1f5f9 25%,transparent 25%),linear-gradient(-45deg,#f1f5f9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f1f5f9 75%),linear-gradient(-45deg,transparent 75%,#f1f5f9 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
                }}
              >
                {item.cropped ? (
                  <div
                    className="h-32 w-32 overflow-hidden rounded-[27%] bg-transparent"
                    style={{
                      backgroundImage: `url(${item.previewPath})`,
                      backgroundPosition: '50% 47%',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '222% 222%',
                    }}
                    aria-label={item.title}
                    role="img"
                  />
                ) : (

                  <img
                    src={item.previewPath}
                    alt={item.title}
                    className="max-h-32 max-w-full object-contain"
                    loading="eager"
                    decoding="async"
                  />
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{item.title}</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{item.badge}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={item.downloadPath}
                  download={item.downloadFileName}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-amber-100 active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LogoDownloads;
