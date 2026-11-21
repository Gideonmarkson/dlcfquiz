'use client';

import React from 'react';

interface ConnectionStatusToastProps {
  isConnected: boolean;
  isReconnecting?: boolean;
}

export const ConnectionStatusToast: React.FC<ConnectionStatusToastProps> = ({ isConnected, isReconnecting = false }) => {
  if (isConnected && !isReconnecting) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-[var(--radius-control)] bg-page px-3.5 py-2 text-sm font-medium text-ink"
    >
      {isReconnecting ? 'Connection lost. Reconnecting…' : 'Connecting…'}
    </div>
  );
};
