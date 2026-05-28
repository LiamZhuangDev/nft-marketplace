"use client";

import { ArrowLeft, Copy, Check, Globe, Star, Share2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalState } from "@/hooks/useGlobalState";
import { useState } from "react";
import { PlaceBidDialog } from "./place-bid-dialog";
import { useRouter, usePathname } from "next/navigation";
import { formatUnits } from "ethers";

function formatStat(value: number | string | undefined, suffix = ""): string {
  const n = Number(value || 0);
  if (n === 0) return `0${suffix}`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K${suffix}`;
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)}${suffix}`;
}

function formatEthStat(value: string | number | undefined): string {
  const n = Number(value || 0);
  if (n === 0) return "0 ETH";
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K ETH`;
  return `${n.toFixed(2)} ETH`;
}

function formatAddress(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function CollectionHeader() {
  const { state } = useGlobalState();
  const router = useRouter();
  const pathname = usePathname();
  const [isBidDialogOpen, setIsBidDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const collection = state.collection;
  const collectionAddress =
    collection?.address || state.collection_address || (pathname ? pathname.split("/").pop() || "" : "");

  const handleCopy = () => {
    if (collectionAddress) {
      navigator.clipboard.writeText(collectionAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const ownerPct =
    collection?.owner_amount && collection?.total_supply
      ? ((collection.owner_amount / collection.total_supply) * 100).toFixed(1)
      : "0";

  const floorPrice = collection?.floor_price
    ? (() => {
        try {
          const n = parseFloat(formatUnits(String(collection.floor_price), 18));
          return n > 0 ? `${n.toFixed(4).replace(/\.?0+$/, "")} ETH` : "— ETH";
        } catch {
          return "— ETH";
        }
      })()
    : "— ETH";

  return (
    <>
      {/* ── Banner ── */}
      <div className="relative w-full h-56 md:h-72 overflow-hidden">
        {collection?.banner || collection?.banner_uri ? (
          <img
            src={collection.banner || collection.banner_uri}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        {/* 返回按钮 */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background/60 backdrop-blur-sm text-foreground text-sm hover:bg-background/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </div>

      {/* ── Collection Info ── */}
      <div className="container mx-auto px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-4 mb-4">
          {/* 头像 */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-4 border-background overflow-hidden bg-muted shadow-lg shrink-0">
            {collection?.image_uri ? (
              <img
                src={collection.image_uri}
                alt={collection.name || "Collection"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://www.metanode.tech/logo.png";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl text-white">
                ?
              </div>
            )}
          </div>

          {/* 名称 + 操作 */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
                {collection?.name || "加载中..."}
              </h1>
              {collection?.name && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
              <Star className="w-4 h-4 text-muted-foreground hover:text-yellow-400 cursor-pointer transition-colors" />
            </div>
            {/* 元信息行 */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {collection?.creator && (
                <span>
                  创建者 <span className="text-foreground font-medium">{formatAddress(collection.creator)}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-indigo-500/40 inline-flex items-center justify-center text-[8px]">
                  Ξ
                </span>
                以太坊
              </span>
              {collection?.total_supply > 0 && (
                <span>{formatStat(collection.total_supply)} 个</span>
              )}
            </div>
          </div>

          {/* 操作按钮组 */}
          <div className="hidden md:flex items-center gap-1.5 pb-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy} title="复制合约地址">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(`https://sepolia.etherscan.io/address/${collectionAddress}`, "_blank")}
              title="在 Etherscan 查看"
            >
              <Globe className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── 统计指标行 ── */}
        <div className="flex items-center gap-8 py-3 border-b border-border overflow-x-auto text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">地板价</div>
            <div className="font-semibold text-foreground mt-0.5">{floorPrice}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">总交易量</div>
            <div className="font-semibold text-foreground mt-0.5">
              {formatEthStat(collection?.volume_total)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">24h 交易量</div>
            <div className="font-semibold text-foreground mt-0.5">
              {formatEthStat(collection?.volume_24h)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">持有者（独立）</div>
            <div className="font-semibold text-foreground mt-0.5">
              {formatStat(collection?.owner_amount)} ({ownerPct}%)
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <Button
              onClick={() => setIsBidDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-9 text-sm"
            >
              出价
            </Button>
          </div>
        </div>
      </div>

      {collectionAddress && (
        <PlaceBidDialog
          open={isBidDialogOpen}
          close={() => setIsBidDialogOpen(false)}
          collectionAddress={collectionAddress}
        />
      )}
    </>
  );
}
