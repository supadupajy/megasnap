"use client";

import React from 'react';
import { Utensils, Car, TreePine, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryMenuProps {
  isOpen: boolean;
  selectedCategory: string;
  onSelect: (category: string) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'all', label: '전체', icon: Sparkles, color: 'bg-indigo-600' },
  { id: 'food', label: '맛집', icon: Utensils, color: 'bg-orange-500' },
  { id: 'accident', label: '사고', icon: Car, color: 'bg-red-600' },
  { id: 'place', label: '명소', icon: TreePine, color: 'bg-green-600' },
];

const CategoryMenu = ({ isOpen, selectedCategory, onSelect, onClose }: CategoryMenuProps) => {
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
            initial={{ opacity: 0, scale: 0.9, x: -20, y: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -20, y: 20 }}
            className="absolute bottom-48 left-4 z-[70] bg-white rounded-[28px] shadow-2xl border border-gray-100 p-3 w-48"
          >
            <div className="flex items-center justify-between px-3 mb-3">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</span>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-1">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSelect(cat.id);
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all active:scale-95",
                      isSelected ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-50 text-gray-600"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm",
                      isSelected ? cat.color : "bg-gray-200"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={cn("text-sm font-bold", isSelected ? "text-indigo-600" : "text-gray-700")}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CategoryMenu;