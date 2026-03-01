'use client';

import { Alert } from '@/lib/alerts';

interface AlertBannerProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

export default function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.severity === 'critical';
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border p-3.5 ${
              isCritical
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <span className="mt-0.5 text-base shrink-0">
              {alert.type === 'anomaly' ? '⚠️' : '📊'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isCritical
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {alert.type === 'anomaly' ? 'ANOMALY' : 'OVER BUDGET'}
                </span>
                <span className="text-[10px] text-[#9B9B9B]">{alert.category}</span>
              </div>
              <h3 className="text-sm font-medium text-[#1A1A1A]">{alert.title}</h3>
              <p className="mt-0.5 text-xs text-[#6B6B6B]">{alert.description}</p>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className="shrink-0 rounded-lg p-1 text-[#9B9B9B] transition-colors hover:bg-black/5 hover:text-[#1A1A1A]"
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
