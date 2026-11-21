'use client';

import React, { useEffect } from 'react';
import { useHostStore, FloatingHypeItem } from '@/store/useHostStore';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';

export const FloatingHypeOverlay: React.FC = () => {
  const hypeQueue = useHostStore((s) => s.hypeQueue);
  const removeHype = useHostStore((s) => s.removeHype);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {hypeQueue.map((item) => (
        <HypeParticle key={item.id} item={item} onComplete={removeHype} />
      ))}
    </div>
  );
};

const HypeParticle: React.FC<{ item: FloatingHypeItem; onComplete: (id: string) => void }> = ({ item, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => onComplete(item.id), 2800);
    return () => clearTimeout(timer);
  }, [item.id, onComplete]);

  return (
    <div className="absolute bottom-16 flex flex-col items-center animate-float-up" style={{ left: `${item.leftPercent}%` }}>
      <span className="text-5xl select-none">{item.emoji}</span>
      <span className="text-xs text-muted">{levelLabel(item.level)}</span>
    </div>
  );
};
