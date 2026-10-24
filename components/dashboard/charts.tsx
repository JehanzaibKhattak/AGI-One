"use client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
export const trend = [
  { month: "Apr", revenue: 25.4, collections: 18.2 },
  { month: "May", revenue: 31.8, collections: 23.1 },
  { month: "Jun", revenue: 28.6, collections: 20.8 },
  { month: "Jul", revenue: 39.2, collections: 27.4 },
  { month: "Aug", revenue: 35.6, collections: 24.8 },
  { month: "Sep", revenue: 48.2, collections: 29.1 },
];
const colors = ["#3565df", "#7192ee", "#a9bdf5", "#d3defa"];
export function RevenueChart({ factor = 1 }: { factor?: number }) {
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Revenue and collections trend, April to September 2026"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={trend.map((d) => ({
            ...d,
            revenue: +(d.revenue * factor).toFixed(1),
            collections: +(d.collections * factor).toFixed(1),
          }))}
          margin={{ top: 15, right: 10, bottom: 0, left: -22 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3565df" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#3565df" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0f4"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8993a4" }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8993a4" }}
            tickFormatter={(v) => `${v}M`}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e8ecf2",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => `PKR ${v}M`}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#3565df"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="collections"
            name="Collections"
            stroke="#43ad91"
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="transparent"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function MiniBar({
  data,
  color = "#3565df",
  horizontal = false,
}: {
  data: { name: string; value: number }[];
  color?: string;
  horizontal?: boolean;
}) {
  return (
    <div
      className="mini-chart"
      role="img"
      aria-label={data.map((d) => `${d.name}: ${d.value}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{
            left: horizontal ? 15 : -18,
            right: 12,
            top: 10,
            bottom: 0,
          }}
        >
          <CartesianGrid stroke="#f0f2f6" vertical={false} />
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={85}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              border: "1px solid #e8ecf2",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="value"
            fill={color}
            radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart() {
  const data = [
    { name: "Instruments", value: 52 },
    { name: "Reagents", value: 28 },
    { name: "Consumables", value: 13 },
    { name: "Spare parts", value: 7 },
  ];
  return (
    <div className="category-chart">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={data}
              dataKey="value"
              innerRadius={56}
              outerRadius={74}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell fill={colors[i]} key={d.name} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <small>Total sales</small>
          <strong>48.2M</strong>
          <span>PKR</span>
        </div>
      </div>
      <div className="category-legend">
        {data.map((d, i) => (
          <div key={d.name}>
            <span>
              <i style={{ background: colors[i] }} />
              {d.name}
            </span>
            <strong>{d.value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
