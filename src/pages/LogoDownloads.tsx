import { useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type LogoItem = {
  title: string;
  description: string;
  svgPath: string;
  pngFileName: string;
  width: number;
  height: number;
};

const LOGOS: LogoItem[] = [
  {
    title: '아이콘',
    description: '앱 아이콘형 심볼',
    svgPath: '/hi-bubble-icon.svg',
    pngFileName: 'hi-bubble-icon.png',
    width: 120,
    height: 120,
  },
  {
    title: '워드마크',
    description: '텍스트 로고',
    svgPath: '/hi-bubble-wordmark.svg',
    pngFileName: 'hi-bubble-wordmark.png',
    width: 520,
    height: 120,
  },
  {
    title: '조합 로고',
    description: '아이콘 + 워드마크',
    svgPath: '/hi-bubble-logo.svg',
    pngFileName: 'hi-bubble-logo.png',
    width: 700,
    height: 160,
  },
];

const LogoDownloads = () => {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadSvgAsPng = async (item: LogoItem) => {
    setDownloading(item.pngFileName);
    try {
      const response = await fetch(item.svgPath, { cache: 'force-cache' });
      const svgText = await response.text();
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);

      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = objectUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = item.width;
        canvas.height = item.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context 생성 실패');

        ctx.clearRect(0, 0, item.width, item.height);
        ctx.drawImage(image, 0, 0, item.width, item.height);

        const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!pngBlob) throw new Error('PNG 생성 실패');

        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = item.pngFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(pngUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setDownloading(null);
    }
  };

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
            <p className="mt-1 text-sm text-slate-500">투명 배경 PNG와 원본 SVG를 바로 저장할 수 있어요.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {LOGOS.map((item) => {
            const isBusy = downloading === item.pngFileName;
            return (
              <div
                key={item.pngFileName}
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
                  <img
                    src={item.svgPath}
                    alt={item.title}
                    className="max-h-28 max-w-full object-contain"
                    loading="eager"
                    decoding="async"
                  />
                </div>

                <div className="mt-4">
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => downloadSvgAsPng(item)}
                    disabled={isBusy}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-amber-100 active:scale-95 disabled:opacity-70"
                  >
                    <Download className="h-4 w-4" />
                    {isBusy ? '생성 중...' : 'PNG 다운로드'}
                  </button>
                  <a
                    href={item.svgPath}
                    download
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 active:scale-95"
                  >
                    SVG
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LogoDownloads;
