"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

const TimeSlider = ({ value, onChange }: TimeSliderProps) => {
  // 1부터 48까지의 시간 (사용자 요청 및 Index.tsx 초기값 반영)
  const hours = Array.from({ length: 48 }, (_, i) => i + 1);

  return (
    <div className="fixed right-4 bottom-[285px] h-[260px] w-10 flex flex-col items-center z-50 pointer-events-none">
      <div className="pointer-events-auto h-full w-full bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/40 flex flex-col items-center py-4 gap-2 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 z-30 bg-white/50 w-full pb-1">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[6px] font-black text-gray-400 uppercase tracking-tighter">Time</span>
        </div>

        {/* Slider Area - 이 영역 안에서만 바가 움직임 */}
        <div className="relative flex-1 w-full px-2 flex flex-col items-center overflow-hidden">
          {/* Track Background */}
          <div className="absolute inset-y-0 w-1.5 bg-gray-100 rounded-full left-1/2 -translate-x-1/2" />
          
          {/* Active Track (Bottom-up) */}
          <motion.div 
            className="absolute bottom-0 w-1.5 bg-indigo-600 rounded-full left-1/2 -translate-x-1/2 origin-bottom"
            initial={false}
            animate={{ height: `${((value - 1) / 47) * 100}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          />

          {/* Interaction Layer */}
          <input
            type="range"
            min="1"
            max="48"
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute w-[160px] h-10 opacity-0 cursor-pointer appearance-none z-20 m-0"
            style={{ 
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              WebkitAppearance: 'none'
            }}
          />

          {/* Markers (Visual only) */}
          <div className="flex-1 w-full flex flex-col justify-between py-1 z-10 pointer-events-none">
            {[...hours].reverse().map((h) => (
              <div key={h} className="flex items-center justify-center w-full">
                <div className={cn(
                  "w-1 h-1 rounded-full transition-colors duration-300",
                  h <= value ? "bg-indigo-600" : "bg-gray-200",
                  h % 12 !== 0 && "opacity-0" // 12시간 단위로만 마커 표시하여 깔끔하게 유지
                )} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center shrink-0 z-30 bg-white/50 w-full pt-1">
          <span className="text-[13px] font-black text-indigo-600 leading-none">{value}</span>
          <span className="text-[7px] font-black text-gray-400 uppercase">HR</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;