"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import activityApi from "@/api/activity";
import { Button } from "@/components/ui/button";
import { formatAddress, getAvatarUrl, getExplorerBaseUrl } from "@/lib/utils";

interface RecentActivityProps {
  collectionAddress?: string;
  chainId?: string | number;
}

interface ActivityItem {
  event_type: string;
  event_time: number;
  price: string;
  maker: string;
  taker: string;
  tx_hash: string;
}

function formatPrice(price: string): string {
  if (!price || price === "0") return "-";
  try {
    const num = parseFloat(formatUnits(price, 18));
    if (num === 0) return "-";
    return num.toFixed(4).replace(/\.?0+$/, "");
  } catch {
    return "-";
  }
}

function formatRelativeTime(seconds: number): string {
  if (!seconds) return "-";
  const diff = Date.now() - seconds * 1000;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return "刚刚";
}

function mapEventType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("sale")) return "成交";
  if (t.includes("list")) return "挂单";
  if (t.includes("cancel")) return "取消";
  if (t.includes("bid") || t.includes("offer")) return "出价";
  return type || "活动";
}

export function RecentActivity({ collectionAddress, chainId = 11155111 }: RecentActivityProps) {
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const normalizedAddress = useMemo(
    () => (collectionAddress || "").trim(),
    [collectionAddress],
  );
  const explorerBaseUrl = useMemo(() => getExplorerBaseUrl(chainId), [chainId]);

  useEffect(() => {
    if (!normalizedAddress) {
      setActivities([]);
      return;
    }

    let disposed = false;
    async function fetchActivities() {
      setLoading(true);
      try {
        const res: any = await activityApi.GetActivity({
          filter_ids: [Number(chainId)],
          collection_addresses: [normalizedAddress],
          user_addresses: [],
          event_types: [],
          page: 1,
          page_size: 6,
        });
        if (!disposed) {
          setActivities(Array.isArray(res?.result) ? res.result : []);
        }
      } catch {
        if (!disposed) setActivities([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    fetchActivities();
    return () => {
      disposed = true;
    };
  }, [normalizedAddress, chainId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">最近动态</h3>
        <Button variant="link" size="sm" disabled>
          查看更多
        </Button>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-xs text-muted-foreground p-2">加载中...</div>}
        {!loading && activities.length === 0 && (
          <div className="text-xs text-muted-foreground p-2">暂无活动</div>
        )}
        {!loading &&
          activities.map((item, i) => (
            <div
              key={`${item.tx_hash || "tx"}-${i}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer"
              onClick={() => {
                if (!item.tx_hash) return;
                window.open(
                  `${explorerBaseUrl}/tx/${item.tx_hash}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              title={item.tx_hash ? "在区块链浏览器中查看交易" : ""}
            >
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={getAvatarUrl(item.maker || item.taker || `${i}`)}
                  alt={item.maker || item.taker || "user"}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`;
                  }}
                />
                <div className="min-w-0">
                  <div className="text-sm truncate">
                    {mapEventType(item.event_type)} · {formatAddress(item.maker || item.taker || "-")}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatRelativeTime(item.event_time)}</div>
                </div>
              </div>
              <div className="text-sm font-medium inline-flex items-center gap-1">
                <img src="/eth.svg" alt="ETH" className="w-8 h-8" />
                {formatPrice(item.price)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

