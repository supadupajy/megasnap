"use client";

import React from 'react';
import { Coffee, Utensils, TreePine, Camera, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'all', label: '전체', icon: Sparkles },
  { id: 'cafe', label: '카페', icon: Coffee },
  { id: 'food', label: '맛집', icon: Utensils },
  { id: 'park', label: '명소', icon: TreePine },
  { id: 'photo', label: '포토존', icon: Camera },
];

interface CategoryFilterProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

const CategoryFilter = ({ selectedId, onSelect }: CategoryFilterProps) => {
  return (
    <div className="absolute top-20 left-0 right-0 z-30 px-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedId === cat.id;
          
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 rounded-full whitespace-nowrap transition-all shadow-sm border",
                isSelected 
                  ? "bg-green-500 border-green-500 text-white font-bold scale-105" 
                  : "bg-white/90 backdrop-blur-md border-gray-100 text-gray-600 hover:bg-white"
              )}
            >
              <Icon className={cn("w-4 h-4", isSelected ? "text-white" : "text-green-500")} />
              <span className="text-sm">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryFilter;