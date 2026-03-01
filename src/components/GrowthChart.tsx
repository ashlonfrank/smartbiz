'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';

const chartData = [
  { month: 'M1',  current: 500,  withHires: 500  },
  { month: 'M2',  current: 550,  withHires: 550  },
  { month: 'M3',  current: 600,  withHires: 600  },
  { month: 'M4',  current: 650,  withHires: 650  },
  { month: 'M5',  current: 700,  withHires: 1200 },
  { month: 'M6',  current: 750,  withHires: 1800 },
  { month: 'M7',  current: 800,  withHires: 2400 },
  { month: 'M8',  current: 850,  withHires: 3000 },
  { month: 'M9',  current: 900,  withHires: 3600 },
  { month: 'M10', current: 950,  withHires: 4200 },
  { month: 'M11', current: 1000, withHires: 5000 },
  { month: 'M12', current: 1050, withHires: 5800 },
  { month: 'M13', current: 1100, withHires: 6600 },
  { month: 'M14', current: 1150, withHires: 7400 },
  { month: 'M15', current: 1200, withHires: 8200 },
  { month: 'M16', current: 1250, withHires: 9000 },
  { month: 'M17', current: 1300, withHires: 10000 },
  { month: 'M18', current: 1350, withHires: 11000 },
  { month: 'M19', current: 1400, withHires: 12000 },
  { month: 'M20', current: 1450, withHires: 13000 },
  { month: 'M21', current: 1500, withHires: 14000 },
  { month: 'M22', current: 1550, withHires: 15000 },
  { month: 'M23', current: 1600, withHires: 16000 },
  { month: 'M24', current: 1650, withHires: 17000 },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-[#E8E8E6] rounded-lg px-4 py-3 shadow-xl">
      <p className="text-[#1A1A1A] font-semibold text-sm mb-1.5">{label}</p>
      <p className="text-[#2D8A56] text-xs mb-1">
        With Hires: <span className="font-bold">${payload[1]?.value.toLocaleString()}</span>
      </p>
      <p className="text-[#6B6B6B] text-xs">
        Current Trajectory: <span className="font-bold">${payload[0]?.value.toLocaleString()}</span>
      </p>
    </div>
  );
}

interface GrowthChartProps {
  expanded?: boolean;
}

export function GrowthChart({ expanded }: GrowthChartProps) {
  return (
    <div className={`w-full ${expanded ? 'h-full' : 'h-[220px]'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: expanded ? 20 : 20, left: expanded ? 0 : -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={true} />
          <XAxis
            dataKey="month"
            stroke="#9B9B9B"
            fontSize={expanded ? 11 : 10}
            tickLine={false}
            axisLine={false}
            ticks={expanded ? ['M1','M3','M6','M8','M10','M12','M14','M16','M18','M20','M22','M24'] : ['M1','M6','M12','M18','M24']}
            dy={10}
          />
          <YAxis
            stroke="#9B9B9B"
            fontSize={expanded ? 11 : 10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val / 1000}k`}
            domain={[0, 18000]}
            ticks={expanded ? [0,2000,4000,6000,8000,10000,12000,14000,16000,18000] : [0,6000,12000,18000]}
          />
          <ReferenceLine x="M6"  stroke="rgba(0,0,0,0.12)" strokeDasharray="3 3" label={{ position: 'top', value: 'New Equipment',       fill: '#9B9B9B', fontSize: 10 }} />
          <ReferenceLine x="M12" stroke="rgba(0,0,0,0.12)" strokeDasharray="3 3" label={{ position: 'top', value: 'Shift Expansion',      fill: '#9B9B9B', fontSize: 10 }} />
          <ReferenceLine x="M24" stroke="rgba(0,0,0,0.12)" strokeDasharray="3 3" label={{ position: 'top', value: 'Second Location',      fill: '#9B9B9B', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.08)', strokeWidth: 1 }} />
          <Line type="monotone" dataKey="current"   stroke="#9B9B9B" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="withHires" stroke="#2D8A56" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
