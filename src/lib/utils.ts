import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getYoutubeId(url: string) {
  if (!url) return null;
  // shorts, watch, embed, youtu.be 등 모든 형식을 지원하는 정규식
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function getYoutubeThumbnail(url: string) {
  const id = getYoutubeId(url);
  if (!id) return null;
  // maxresdefault는 일부 영상에서 404가 발생하므로 가장 안정적인 hqdefault 사용
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}