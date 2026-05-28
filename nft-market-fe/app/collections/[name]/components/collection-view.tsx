"use client";

import { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  List,
  StretchHorizontal,
  Settings,
} from "lucide-react";
import { ItemsGrid } from "./items-grid";
import { TradingView } from "./trading-view";
import { RecentActivity } from "./recent-activity";

type ViewSize = "lg" | "md" | "sm" | "xs" | "list";

const VIEW_OPTIONS: { size: ViewSize; icon: React.ReactNode }[] = [
  { size: "lg", icon: <Grid2X2 className="h-4 w-4" /> },
  { size: "md", icon: <Grid3X3 className="h-4 w-4" /> },
  { size: "sm", icon: <LayoutGrid className="h-4 w-4" /> },
  { size: "xs", icon: <StretchHorizontal className="h-4 w-4" /> },
  { size: "list", icon: <List className="h-4 w-4" /> },
];

const GRID_COLS: Record<ViewSize, string> = {
  lg: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  md: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  sm: "grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
  xs: "grid-cols-5 md:grid-cols-6 lg:grid-cols-7",
  list: "",
};

const TABS = [
  { label: "物品", id: "items" },
  { label: "报价", id: "offers" },
  { label: "动态", id: "activity" },
  { label: "分析", id: "analytics" },
] as const;

interface CollectionViewProps {
  items?: any[];
  chainId?: string | number;
  collectionAddress?: string;
}

export function CollectionView({
  items = [],
  chainId,
  collectionAddress,
}: CollectionViewProps) {
  const [activeTab, setActiveTab] = useState<string>("items");
  const [viewSize, setViewSize] = useState<ViewSize>("md");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.name || "").toLowerCase().includes(q) ||
      String(item.token_id).includes(q)
    );
  });

  return (
    <div className="container mx-auto px-4">
      {/* ── Tab 导航 ── */}
      <div className="flex items-center gap-1 border-b border-border mt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Items Tab ── */}
      {activeTab === "items" && (
        <div className="mt-4">
          {/* 工具栏 */}
          <div className="flex items-center gap-3 mb-3">
            {/* 筛选器切换 */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border rounded-xl transition-colors ${
                showFilters
                  ? "border-foreground/30 bg-accent text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {/* 搜索 */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索物品或特征"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
              />
            </div>

            <div className="flex-1" />

            {/* 排序下拉 */}
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-xl hover:border-foreground/30 transition-colors">
              价格从低到高
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* 视图切换 */}
            <div className="flex items-center border border-border rounded-xl overflow-hidden">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => setViewSize(opt.size)}
                  className={`p-2 transition-colors ${
                    viewSize === opt.size
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            <button className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Items 数量指示 */}
          <div className="text-xs text-muted-foreground mb-3">
            {filteredItems.length.toLocaleString()} 个物品
          </div>

          {/* 主内容区 */}
          <div className="flex gap-6">
            {/* 筛选面板（可折叠） */}
            {showFilters && (
              <div className="w-64 shrink-0 border border-border rounded-xl p-4 h-fit space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">状态</h4>
                  <div className="flex flex-wrap gap-2">
                    {["已挂单", "有报价"].map((s) => (
                      <button
                        key={s}
                        className="px-3 py-1 text-xs border border-border rounded-lg text-muted-foreground hover:border-foreground/30 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">价格</h4>
                  <div className="flex gap-2">
                    <input
                      placeholder="最低"
                      className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                    <input
                      placeholder="最高"
                      className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* NFT 网格 */}
            <div className="flex-1 min-w-0">
              <ItemsGrid
                items={filteredItems}
                chainId={chainId}
                gridCols={GRID_COLS[viewSize]}
                viewSize={viewSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Offers Tab ── */}
      {activeTab === "offers" && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-muted-foreground text-sm">报价功能开发中</p>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === "activity" && (
        <div className="py-6 max-w-3xl">
          <RecentActivity chainId={chainId} collectionAddress={collectionAddress} />
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (
        <div className="py-6">
          <TradingView chainId={chainId} collectionAddress={collectionAddress} />
        </div>
      )}
    </div>
  );
}
