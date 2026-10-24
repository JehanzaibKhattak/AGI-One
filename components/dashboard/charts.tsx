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
} from "recharts";
export function RevenueChart({
  data,
  currency,
}: {
  data: { month: string; revenue: number; collections: number }[];
  currency: string;
}) {
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Issued sales and collections for the selected period"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
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
            tickFormatter={(v) => String(v)}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e8ecf2",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => `${currency} ${v}`}
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
