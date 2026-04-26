"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

// 슬라이더 스텝: 1,2,3,...,24,36,48,72,96,120,144,168
const STEPS = [
  1, 2, 3, 6, 12, 24, 36, 48, 72, 96, 120, 144, 168
];

const TimeSlider = ({ value, onChange }: TimeSliderProps) => {
  const currentIndex = STEPS.reduce((best, s, i) =>
    Math.abs(s - value) < Math.abs(STEPS[best] - value) ? i : best, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value);
    onChange(STEPS[idx]);
  };

  const displayLabel = value >= 24 ? `${value / 24}d` : `${value}h`;

  return (
    <div className="fixed right-4 bottom-[285px] h-[260px] w-10 flex flex-col items-center z-50 pointer-events-none">
      <div className="pointer-events-auto h-full w-full bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/40 flex flex-col items-center py-4 gap-2 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 z-30 bg-white/50 w-full pb-1">
          <Clock className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[6px] font-black text-gray-400 uppercase tracking-tighter">Time</span>
        </div>

        {/* Slider Area */}
        <div className="relative flex-1 w-full px-2 flex flex-col items-center overflow-hidden">
          {/* Track Background */}
          <div className="absolute inset-y-0 w-1.5 bg-gray-100 rounded-full left-1/2 -translate-x-1/2" />
          
          {/* Active Track (Bottom-up) */}
          <motion.div 
            className="absolute bottom-0 w-1.5 bg-indigo-600 rounded-full left-1/2 -translate-x-1/2 origin-bottom"
            initial={false}
            animate={{ height: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          />

          {/* Interaction Layer */}
          <input
            type="range"
            min="0"
            max={STEPS.length - 1}
            step="1"
            value={currentIndex}
            onChange={handleChange}
            className="absolute w-[160px] h-10 opacity-0 cursor-pointer appearance-none z-20 m-0"
            style={{ 
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-90deg)',
              WebkitAppearance: 'none'
            }}
          />

          {/* Markers */}
          <div className="flex-1 w-full flex flex-col justify-between py-1 z-10 pointer-events-none">
            {[...STEPS].reverse().map((s, i) => {
              const stepIdx = STEPS.length - 1 - i;
              return (
                <div key={s} className="flex items-center justify-center w-full">
                  <div className={cn(
                    "rounded-full transition-colors duration-300",
                    stepIdx <= currentIndex ? "bg-indigo-600" : "bg-gray-200",
                    s % 24 === 0 ? "w-1.5 h-1.5" : "w-1 h-1 opacity-50"
                  )} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center shrink-0 z-30 bg-white/50 w-full pt-1">
          <span className="text-[11px] font-black text-indigo-600 leading-none">{displayLabel}</span>
          <span className="text-[7px] font-black text-gray-400 uppercase">ago</span>
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;
