import React from 'react';
import { AcademicLevel } from '@/types/quiz';

export function levelLabel(level: AcademicLevel): string {
  return level === 'PG/STAFF' ? 'PG/Staff' : level;
}

interface AcademicLevelBadgeProps {
  level: AcademicLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_STYLES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/** Level shown as quiet secondary text next to a name, not a coloured pill. */
export const AcademicLevelBadge: React.FC<AcademicLevelBadgeProps> = ({ level, className = '', size = 'md' }) => (
  <span className={`tabular-nums text-muted ${SIZE_STYLES[size]} ${className}`}>{levelLabel(level)}</span>
);
