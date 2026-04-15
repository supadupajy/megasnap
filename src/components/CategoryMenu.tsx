"use client";

import React from 'react';
import { Utensils, Car, TreePine, Sparkles, X, PawPrint, Flame, Star, Check, User, Coffee, ShoppingBag, Mountain, Ticket, CircleP } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';

interface CategoryMenuProps {
  isOpen: boolean;
  selectedCategories: string[];
  onSelect: (categories: string[]) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'food', label: '맛집', icon: Utensils, color: 'bg-orange-500' },
  { id: 'cafe', label: '카페', icon: Coffee, color: 'bg-amber-700' },
  { id: 'shopping', label: '쇼핑', icon: ShoppingBag, color: 'bg-pink-500' },
  { id: 'place', label: '명소', icon: TreePine, color: 'bg-green-600' },
  { id: 'nature', label: '자연', icon: Mountain, color: 'bg-emerald-600' },
  { id: 'animal', label: '동물', icon: PawPrint, color: 'bg-purple-600' },
  { id: 'event', label: '행사', icon: Ticket, color: 'bg-indigo-500' },
  { id: 'parking', label: '주차', icon: CircleP, color: 'bg-blue-600' },
  { id: 'accident', label: '사고', icon: Car, color: 'bg-red-600' },
];

const SPECIAL_FILTERS = [
  { id: 'hot', label: 'HOT 포스팅', icon: Flame, color: 'bg-red-500' },
  { id: 'influencer', label: 'Influencer', icon: Star, color: 'bg-yellow-400' },
  { id: 'mine', label: '내 포스팅만 보기', icon: User, color: 'bg-blue-600' },
];

const CategoryMenu = ({ isOpen, selectedCategories, onSelect, onClose }: CategoryMenuProps) => {
  const isAllSelected = selectedCategories.includes('all');

  const toggleCategory = (id: string) => {
    if (id === 'all') {
      onSelect(['all']);
      return;
    }

    let next = selectedCategories.filter(c => c !== 'all');
    if (next.includes(id)) {
      next = next.filter(c => c !== id);
    } else {
      next = [...next, id];
    }

    if (next.length === 0) {
      onSelect(['all']);
    } else {
      onSelect(next);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
          />
          
          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-[140px] left-4 z-[70] bg-white rounded-[32px] shadow-2xl border border-gray-100 p-5 w-64"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-xs font-black text-gray-900 uppercase tracking-widest">필터 설정</span>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-5">
              {/* All Toggle */}
              <button
                onClick={() => toggleCategory('all')}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-2xl transition-all border-2",
                  isAllSelected ? "bg-indigo-50 border-indigo-600" : "bg-gray-50 border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", isAllSelected ? "bg-indigo-600" : "bg-gray-300")}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className={cn("text-sm font-bold", isAllSelected ? "text-indigo-600" : "text-gray-600")}>전체 보기</span>
                </div>
                {isAllSelected && <Check className="w-4 h-4 text-indigo-600" />}
              </button>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">카테고리</p>
                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isChecked = selectedCategories.includes(cat.id);
                    
                    return (
                      <div 
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white transition-transform group-active:scale-90", isChecked ? cat.color : "bg-gray-100 text-gray-400")}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={cn("text-sm font-bold", isChecked ? "text-gray-900" : "text-gray-500")}>{cat.label}</span>
                        </div>
                        <Checkbox 
                          checked={isChecked} 
                          onCheckedChange={() => toggleCategory(cat.id)}
                          className="rounded-md border-gray-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">특수 필터</p>
                <div className="grid grid-cols-1 gap-2">
                  {SPECIAL_FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    const isChecked = selectedCategories.includes(filter.id);
                    
                    return (
                      <div 
                        key={filter.id}
                        onClick={() => toggleCategory(filter.id)}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white transition-transform group-active:scale-90", isChecked ? filter.color : "bg-gray-100 text-gray-400")}>
                            <Icon className={cn("w-4 h-4", (filter.id === 'hot' || filter.id === 'mine') && isChecked && "fill-white")} />
                          </div>
                          <span className={cn("text-sm font-bold", isChecked ? "text-gray-900" : "text-gray-500")}>{filter.label}</span>
                        </div>
                        <Checkbox 
                          checked={isChecked} 
                          onCheckedChange={() => toggleCategory(filter.id)}
                          className="rounded-md border-gray-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryMenu;