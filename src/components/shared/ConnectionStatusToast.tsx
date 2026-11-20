'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusToastProps {
  isConnected: boolean;
  isReconnecting?: boolean;
}

export const ConnectionStatusToast: React.FC<ConnectionStatusToastProps> = ({
  isConnected,
  isReconnecting = false,
}) => {
  if (isConnected && !isReconnecting) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500/90 text-slate-950 font-semibold text-xs md:text-sm rounded-full shadow-lg border border-amber-400 flex items-center gap-2 backdrop-blur animate-bounce">
      {isReconnecting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
          <span>Reconnecting to fellowship server...</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-slate-950" />
          <span>Weak connection. Retrying...</span>
        </>
      )}
    </div>
  );
};
