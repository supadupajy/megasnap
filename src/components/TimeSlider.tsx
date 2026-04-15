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
  // 1부터 12까지의 시간 (시각적으로는 12가 위, 1이 아래)
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 h-1/3 w-14 flex flex-col items-center z-50 pointer-events-none">
      <div className="pointer-events-auto h-full w-full bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 flex flex-col items-center py-3 gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Time</span>
        </div>

        <div className="flex-1 w-full px-2 relative flex flex-col items-center">
          {/* Track Background */}
          <div className="absolute inset-y-0 w-1 bg-gray-100 rounded-full left-1/2 -translate-x-1/2" />
          
          {/* Active Track (Bottom-up) */}
          <motion.div 
            className="absolute bottom-0 w-1 bg-indigo-600 rounded-full left-1/2 -translate-x-1/2 origin-bottom"
            initial={false}
            animate={{ height: `${((value - 1) / 11) * 100}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          />

          {/* Vertical Input */}
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-20"
            style={{ 
              WebkitAppearance: 'slider-vertical',
              writingMode: 'bt-lr'
            } as any}
          />

          {/* Markers */}
          <div className="flex-1 w-full flex flex-col justify-between py-1 z-10 pointer-events-none">
            {[...hours].reverse().map((h) => (
              <div key={h} className="flex items-center justify-center w-full">
                <div className={cn(
                  "w-0.5 h-0.5 rounded-full transition-colors duration-300",
                  h <= value ? "bg-indigo-600" : "bg-gray-300"
                )} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-sm font-black text-indigo-600 leading-none">{value}</span>
          <span className="text-[7px] font-bold text-gray-400">HR</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;