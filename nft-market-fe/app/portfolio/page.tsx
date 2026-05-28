"use client";

import { MainContent } from "./components/main-content";
import { Sidebar } from "./components/sidebar";
import { useAccount } from "wagmi";
import { usePortfolioData } from "./hooks/use-portfolio-data";
import { portfolioThemeVars } from "./portfolio-theme";
import { useState } from "react";
import { Copy, Check, MoreHorizontal } from "lucide-react";

const TABS = ["库存", "挂单", "出价", "成交", "动态"] as const;

function formatAddress(addr?: string) {
  if (!addr) return "0x0000...0000";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Home() {
  const { address: owner, chainId } = useAccount();
  const {
    myListOrders,
    myBids,
    myMatchedOrders,
    myItems,
    loadingListOrders,
    loadingBids,
    loadingMatchedOrders,
    loadingItems,
    refreshItems,
  } = usePortfolioData({ owner, chainId });

  const [tabIndex, setTabIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (owner) {
      navigator.clipboard.writeText(owner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const totalNfts = myItems?.length || 0;

  return (
    <div
      style={portfolioThemeVars}
      className="flex flex-col min-h-screen bg-[var(--pf-bg-main)]"
    >
      {/* ── Banner 渐变背景 ── */}
      <div className="relative h-52 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-indigo-500/30 to-rose-500/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pf-bg-main)] via-transparent to-transparent" />
      </div>

      {/* ── 用户信息栏 ── */}
      <div className="relative px-8 -mt-16 pb-0">
        <div className="flex items-end gap-4">
          <div className="w-24 h-24 rounded-full border-4 border-[var(--pf-bg-main)] bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-3xl shadow-lg">
            🐒
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--pf-text-primary)] truncate">
                {formatAddress(owner)}
              </h1>
              <button onClick={handleCopy} className="p-1 hover:bg-white/10 rounded transition-colors">
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--pf-text-muted)]" />
                )}
              </button>
              <button className="p-1 hover:bg-white/10 rounded transition-colors">
                <MoreHorizontal className="w-4 h-4 text-[var(--pf-text-muted)]" />
              </button>
            </div>
            {owner && (
              <span className="text-xs text-[var(--pf-text-muted)] bg-[var(--pf-surface)] px-2 py-0.5 rounded mt-1 inline-block font-mono">
                {owner.slice(0, 6).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 pb-2 text-sm">
            <div className="text-right">
              <div className="text-[var(--pf-text-muted)] text-xs">NFTs</div>
              <div className="text-[var(--pf-text-primary)] font-semibold">{totalNfts}</div>
            </div>
            <div className="text-right">
              <div className="text-[var(--pf-text-muted)] text-xs">挂单</div>
              <div className="text-[var(--pf-text-primary)] font-semibold">{myListOrders?.length || 0}</div>
            </div>
            <div className="text-right">
              <div className="text-[var(--pf-text-muted)] text-xs">出价</div>
              <div className="text-[var(--pf-text-primary)] font-semibold">{myBids?.length || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab 导航 ── */}
      <div className="px-8 mt-4 border-b border-[var(--pf-border)]">
        <div className="flex gap-1">
          {TABS.map((label, idx) => (
            <button
              key={label}
              onClick={() => setTabIndex(idx)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                tabIndex === idx
                  ? "border-[var(--pf-text-primary)] text-[var(--pf-text-primary)]"
                  : "border-transparent text-[var(--pf-text-muted)] hover:text-[var(--pf-text-secondary)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 主内容：左侧筛选 + 右侧内容 ── */}
      <div className="flex flex-1">
        <Sidebar />
        <MainContent
          tabIndex={tabIndex}
          myListOrders={myListOrders}
          myBids={myBids}
          myMatchedOrders={myMatchedOrders}
          myItems={myItems}
          loadingListOrders={loadingListOrders}
          loadingBids={loadingBids}
          loadingMatchedOrders={loadingMatchedOrders}
          loadingItems={loadingItems}
          onImportSuccess={refreshItems}
        />
      </div>
    </div>
  );
}
