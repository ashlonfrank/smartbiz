'use client';

import { Alert } from '@/lib/alerts';

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

export default function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {alerts.map((alert) => {
        const isCritical = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              isCritical
                ? 'border-red-500/30 bg-red-500/5'
                : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <span className="mt-0.5 text-lg shrink-0">
              {alert.type === 'anomaly' ? '⚠️' : '📊'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isCritical
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {alert.type === 'anomaly' ? 'ANOMALY' : 'OVER BUDGET'}
                </span>
                <span className="text-[10px] text-slate-500">{alert.category}</span>
              </div>
              <h3 className="text-sm font-medium text-white">{alert.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{alert.description}</p>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
              title="Dismiss alert"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
