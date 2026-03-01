'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';
import { DailyFlow } from '@/lib/types';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  const hist = payload.find((p) => p.dataKey === 'cumulative');
  const fore = payload.find((p) => p.dataKey === 'forecast');
  return (
    <div className="bg-white border border-[#E8E8E6] rounded-lg px-4 py-3 shadow-xl">
      <p className="text-[#1A1A1A] font-semibold text-sm mb-1.5">{label}</p>
      {hist?.value != null && (
        <p className="text-[#6B6B6B] text-xs">
          Net Flow: <span className="text-[#1A1A1A] font-bold">${hist.value.toLocaleString()}</span>
        </p>
      )}
      {fore?.value != null && (
        <p className="text-[#6B6B6B] text-xs">
          Projected: <span className="text-[#1A1A1A] font-bold">${fore.value.toLocaleString()}</span>
        </p>
      )}
    </div>
  );
}

interface StabilityChartProps {
  expanded?: boolean;
  chartData?: DailyFlow[];
  safetyFloor?: number;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StabilityChart({ expanded, chartData = [], safetyFloor = 0 }: StabilityChartProps) {
  const displayData = chartData.map((d) => ({
    date: formatShortDate(d.date),
    cumulative: d.forecast == null ? d.cumulative : undefined,
    forecast: d.forecast,
  }));

  const allValues = chartData.map((d) => d.forecast ?? d.cumulative);
  const minVal = Math.min(...allValues, safetyFloor);
  const maxVal = Math.max(...allValues);
  const padding = Math.abs(maxVal - minVal) * 0.2 || 1000;
  const domainMin = Math.floor((minVal - padding) / 1000) * 1000;
  const domainMax = Math.ceil((maxVal + padding) / 1000) * 1000;

  const todayLabel = formatShortDate(new Date().toISOString().split('T')[0]);

  // Pick ~5 tick labels evenly spread
  const tickCount = expanded ? 8 : 5;
  const step = Math.max(1, Math.floor(displayData.length / tickCount));
  const ticks = displayData.filter((_, i) => i % step === 0 || i === displayData.length - 1).map((d) => d.date);

  return (
    <div className={`w-full ${expanded ? 'h-full' : 'h-[260px]'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={displayData}
          margin={{ top: 20, right: expanded ? 20 : 0, left: expanded ? 0 : -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradHistorical2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D7C66" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0D7C66" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradForecast2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6BB5A5" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#6BB5A5" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={true} />

          <XAxis
            dataKey="date"
            stroke="#9B9B9B"
            fontSize={expanded ? 11 : 10}
            tickLine={false}
            axisLine={false}
            ticks={ticks}
            dy={10}
          />
          <YAxis
            stroke="#9B9B9B"
            fontSize={expanded ? 11 : 10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            domain={[domainMin, domainMax]}
          />

          {safetyFloor !== 0 && (
            <ReferenceLine
              y={safetyFloor}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ position: 'insideTopLeft', value: `Reserve ($${safetyFloor.toLocaleString()})`, fill: '#f59e0b', fontSize: 10, offset: 5 }}
            />
          )}
          <ReferenceLine
            x={todayLabel}
            stroke="rgba(0,0,0,0.15)"
            strokeDasharray="4 4"
            label={{ position: 'top', value: 'Today', fill: '#9B9B9B', fontSize: 10, offset: 10 }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.08)', strokeWidth: 1 }} />

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="#0D7C66"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gradHistorical2)"
            isAnimationActive={false}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#6BB5A5"
            strokeWidth={2}
            strokeDasharray="5 4"
            fillOpacity={1}
            fill="url(#gradForecast2)"
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
