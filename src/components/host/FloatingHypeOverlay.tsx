'use client';

import React, { useEffect } from 'react';
import { useHostStore, FloatingHypeItem } from '@/store/useHostStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';

export const FloatingHypeOverlay: React.FC = () => {
  const hypeQueue = useHostStore((s) => s.hypeQueue);
  const removeHype = useHostStore((s) => s.removeHype);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {hypeQueue.map((item) => (
        <HypeParticle key={item.id} item={item} onComplete={removeHype} />
      ))}
    </div>
  );
};

const HypeParticle: React.FC<{
  item: FloatingHypeItem;
  onComplete: (id: string) => void;
}> = ({ item, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete(item.id);
    }, 2800);
    return () => clearTimeout(timer);
  }, [item.id, onComplete]);

  return (
    <div
      className="absolute bottom-16 flex items-center gap-1 animate-float-up"
      style={{ left: `${item.leftPercent}%` }}
    >
      <span className="text-4xl md:text-5xl drop-shadow-md select-none">{item.emoji}</span>
      <AcademicLevelBadge level={item.level} size="sm" className="shadow-md" />
    </div>
  );
};
