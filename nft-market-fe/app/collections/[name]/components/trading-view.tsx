"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import collectionsApi from "@/api/collections";
import { getExplorerBaseUrl } from "@/lib/utils";

type Duration = "24h" | "7d" | "30d";
type ViewType = "depth" | "sales";

interface TradingViewProps {
  chainId?: string | number;
  collectionAddress?: string;
}

interface HistorySalesPoint {
  price: string;
  token_id: string;
  time_stamp: number;
}

interface SalesChartPoint {
  x: string;
  price: number;
  time: number;
  volumeBar: number;
  scatterSize: number;
}

function toEthDisplay(raw: string): number {
  if (!raw) return 0;
  try {
    // 优先按 wei 解析；若数据本身已是小数，再走兜底逻辑
    return Number(formatUnits(BigInt(raw), 18));
  } catch {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
}

function getNiceStep(rawStep: number): number {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  for (const step of steps) {
    if (rawStep <= step) return step;
  }
  return 10;
}

export function TradingView({ chainId = 11155111, collectionAddress }: TradingViewProps) {
  const [duration, setDuration] = useState<Duration>("24h");
  const [viewType, setViewType] = useState<ViewType>("sales");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<HistorySalesPoint[]>([]);

  useEffect(() => {
    if (!collectionAddress) return;
    let disposed = false;

    async function fetchSales() {
      setLoading(true);
      try {
        const res: any = await collectionsApi.GetHistorySales({
          address: collectionAddress,
          chain_id: chainId,
          duration,
        });
        if (!disposed) {
          setPoints(Array.isArray(res?.result) ? res.result : []);
        }
      } catch {
        if (!disposed) setPoints([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    fetchSales();
    return () => {
      disposed = true;
    };
  }, [collectionAddress, chainId, duration]);

  const chartData = useMemo(
    (): SalesChartPoint[] => {
      const sorted = points.slice().sort((a, b) => a.time_stamp - b.time_stamp);
      if (sorted.length === 0) return [];

      const avgGapSec =
        sorted.length > 1
          ? (sorted[sorted.length - 1].time_stamp - sorted[0].time_stamp) / (sorted.length - 1)
          : 0;

      return sorted.map((p, index, arr) => {
        const date = new Date(p.time_stamp * 1000);
        const price = toEthDisplay(p.price);
        const prevPrice = index > 0 ? toEthDisplay(arr[index - 1].price) : price;
        const prevTime = index > 0 ? arr[index - 1].time_stamp : p.time_stamp;
        const delta = Math.abs(price - prevPrice);
        const gapSec = Math.max(1, p.time_stamp - prevTime);
        const gapWeight = avgGapSec > 0 ? Math.min(2, gapSec / avgGapSec) : 1;
        const recencyWeight = (index + 1) / arr.length;

        // 底部竖线分布规则：价格波动越大、时间间隔越长、越接近当前，柱体越高。
        const volumeBar = Math.max(
          0.06,
          Math.min(0.52, 0.06 + delta * 2.8 + gapWeight * 0.12 + recencyWeight * 0.14),
        );
        const scatterSize = Math.max(3, Math.min(7, 3 + delta * 24 + recencyWeight * 1.5));

        return {
          x: duration === "24h" ? `${date.getHours()}时` : `${date.getMonth() + 1}/${date.getDate()}`,
          price,
          time: p.time_stamp,
          volumeBar,
          scatterSize,
        };
      });
    },
    [points, duration],
  );

  const yTicks = useMemo(() => {
    if (chartData.length === 0) return [];
    const prices = chartData.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = Math.max(0.01, max - min);
    const step = getNiceStep(range / 6);
    const start = Math.floor((min - step * 0.6) / step) * step;
    const end = Math.ceil((max + step * 0.6) / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step / 2; v += step) {
      ticks.push(Number(v.toFixed(4)));
      if (ticks.length > 10) break;
    }
    return ticks;
  }, [chartData]);

  const priceDomain = useMemo(() => {
    if (yTicks.length >= 2) return [yTicks[0], yTicks[yTicks.length - 1]];
    if (chartData.length === 0) return [0, 1];
    const p = chartData[0].price;
    return [Math.max(0, p - 0.1), p + 0.1];
  }, [yTicks, chartData]);

  return (
    <div className="rounded-lg border border-border p-4 space-y-4 bg-[#0b0b0d]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs defaultValue="sales" onValueChange={(v) => setViewType(v as ViewType)}>
          <TabsList className="bg-[#121215] border border-[#2a2a2f]">
            <TabsTrigger value="depth">深度</TabsTrigger>
            <TabsTrigger value="sales">销售</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant={duration === "24h" ? "default" : "outline"}
            size="sm"
            onClick={() => setDuration("24h")}
          >
            1天
          </Button>
          <Button
            variant={duration === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDuration("7d")}
          >
            1周
          </Button>
          <Button
            variant={duration === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setDuration("30d")}
          >
            1个月
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            title="到区块链浏览器查看合约"
            onClick={() => {
              if (!collectionAddress) return;
              const base = getExplorerBaseUrl(chainId);
              window.open(`${base}/address/${collectionAddress}`, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="h-[240px] rounded-lg border border-[#232329] bg-[#0e0e12] p-2">
        {viewType === "depth" ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            深度图开发中
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            销售数据加载中...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            暂无销售数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="volumeFade" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.25} />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="#2d2d33" strokeOpacity={0.7} vertical={false} />
              <XAxis
                dataKey="x"
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                yAxisId="price"
                stroke="#9ca3af"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={46}
                ticks={yTicks}
                domain={priceDomain as [number, number]}
                tickFormatter={(v) => `${Number(v).toFixed(2)}`}
              />
              <YAxis yAxisId="volume" hide domain={[0, 0.6]} />
              <Tooltip
                contentStyle={{ background: "#141418", border: "1px solid #2a2a2f", borderRadius: 8, color: "#fff" }}
                labelStyle={{ color: "#d1d5db" }}
                formatter={(value: number, name: string) => {
                  if (name === "volumeBar") return ["", ""];
                  return [`${value.toFixed(4)} ETH`, "成交价"];
                }}
              />
              <Bar
                yAxisId="volume"
                dataKey="volumeBar"
                barSize={2}
                fill="url(#volumeFade)"
                radius={[2, 2, 0, 0]}
                opacity={0.95}
              />
              <Line
                yAxisId="price"
                type="stepAfter"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={6}
                strokeOpacity={0.16}
                dot={false}
                isAnimationActive={false}
                filter="url(#lineGlow)"
              />
              <Line
                yAxisId="price"
                type="stepAfter"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#f59e0b", stroke: "#111827" }}
                isAnimationActive={false}
              />
              <Scatter
                yAxisId="price"
                dataKey="price"
                fill="#d1d5db"
                stroke="#111827"
                shape={(props: any) => {
                  const r = Math.max(2.8, Math.min(6.5, props?.payload?.scatterSize ?? 3.2));
                  return (
                    <g>
                      <circle cx={props.cx} cy={props.cy} r={r + 2} fill="#f59e0b" opacity={0.16} />
                      <circle cx={props.cx} cy={props.cy} r={r} fill="#cbd5e1" stroke="#111827" strokeWidth={1} />
                    </g>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

