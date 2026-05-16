import { create } from 'zustand';

interface MediaFile {
  file: File;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
  thumbnailBlob?: Blob;
  crop?: { x: number; y: number };
  zoom?: number;
  orientation?: 'landscape' | 'portrait';
  // 가로 이미지에서 사용자가 보고 있는 원본 픽셀 영역 (정확한 업로드 크롭을 위해 저장)
  landscapeViewport?: { sx: number; sy: number; sw: number; sh: number };
}

interface WriteStore {
  mediaFiles: MediaFile[];
  content: string;
  category: string;
  setMediaFiles: (files: MediaFile[]) => void;
  setContent: (content: string) => void;
  setCategory: (category: string) => void;
  clear: () => void;
}

export const useWriteStore = create<WriteStore>((set) => ({
  mediaFiles: [],
  content: '',
  category: 'none',
  setMediaFiles: (mediaFiles) => set({ mediaFiles }),
  setContent: (content) => set({ content }),
  setCategory: (category) => set({ category }),
  clear: () => set({ mediaFiles: [], content: '', category: 'none' }),
}));
