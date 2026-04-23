import { create } from 'zustand';

interface MediaFile {
  file: File;
  url: string;
  type: 'image' | 'video';
  thumbnail?: string;
  crop?: { x: number; y: number };
  zoom?: number;
  orientation?: 'landscape' | 'portrait';
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
