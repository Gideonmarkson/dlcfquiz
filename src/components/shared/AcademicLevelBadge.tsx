import React from 'react';
import { AcademicLevel } from '@/types/quiz';

interface AcademicLevelBadgeProps {
  level: AcademicLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const LEVEL_STYLES: Record<AcademicLevel, string> = {
  '100L': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  '200L': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  '300L': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  '400L': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  '500L': 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'PG/STAFF': 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
};

const SIZE_STYLES = {
  sm: 'text-xs px-2 py-0.5 border font-semibold rounded-md',
  md: 'text-xs px-2.5 py-1 border font-bold rounded-lg',
  lg: 'text-sm px-3 py-1.5 border font-extrabold rounded-xl',
};

export const AcademicLevelBadge: React.FC<AcademicLevelBadgeProps> = ({
  level,
  className = '',
  size = 'md',
}) => {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES['100L'];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      className={`inline-flex items-center justify-center tracking-wide uppercase ${style} ${sizeStyle} ${className}`}
    >
      {level}
    </span>
  );
};
