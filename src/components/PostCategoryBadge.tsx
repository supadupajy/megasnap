import { Utensils, Car, TreePine, PawPrint } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostCategoryBadgeProps {
  category?: string | null;
}

const CATEGORY_MAP = {
  food: { Icon: Utensils, bgColor: 'bg-orange-500', label: '맛집' },
  accident: { Icon: Car, bgColor: 'bg-red-600', label: '사고' },
  place: { Icon: TreePine, bgColor: 'bg-green-600', label: '명소' },
  animal: { Icon: PawPrint, bgColor: 'bg-purple-600', label: '동물' },
} as const;

const PostCategoryBadge = ({ category }: PostCategoryBadgeProps) => {
  if (!category || category === 'none') return null;
  const info = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP];
  if (!info) return null;

  const { Icon, bgColor, label } = info;
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-white shadow-sm border border-white/10 shrink-0 whitespace-nowrap leading-none h-auto',
        bgColor
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-black">{label}</span>
    </div>
  );
};

export default PostCategoryBadge;
