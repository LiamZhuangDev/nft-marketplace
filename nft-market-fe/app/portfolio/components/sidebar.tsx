"use client";

import { useState } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Search } from "lucide-react";

interface FilterSection {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: FilterSection) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--pf-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-[var(--pf-text-primary)] hover:bg-white/5 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

const STATUS_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "已挂单", value: "listed" },
  { label: "未挂单", value: "unlisted" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  if (collapsed) {
    return (
      <div className="w-12 border-r border-[var(--pf-border)] bg-[var(--pf-bg-sidebar)] flex flex-col items-center pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="展开筛选"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--pf-text-muted)] rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 border-r border-[var(--pf-border)] bg-[var(--pf-bg-sidebar)] flex flex-col shrink-0">
      {/* 收起按钮 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--pf-border)]">
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="收起筛选"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--pf-text-muted)]" />
        </button>
      </div>

      {/* Status 筛选 */}
      <CollapsibleSection title="状态">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                status === opt.value
                  ? "bg-[var(--pf-text-primary)] text-[var(--pf-bg-main)] border-[var(--pf-text-primary)]"
                  : "bg-transparent text-[var(--pf-text-secondary)] border-[var(--pf-border)] hover:border-[var(--pf-text-muted)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* Chains 筛选 */}
      <CollapsibleSection title="区块链" defaultOpen={false}>
        <div className="flex items-center gap-2 text-sm text-[var(--pf-text-muted)]">
          <div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center">
            <span className="text-xs">Ξ</span>
          </div>
          <span className="text-[var(--pf-text-secondary)]">Sepolia</span>
        </div>
      </CollapsibleSection>

      {/* Collections 筛选 */}
      <CollapsibleSection title="合集">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--pf-text-muted)]" />
          <input
            type="text"
            placeholder="搜索合集"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--pf-surface)] border border-[var(--pf-border-soft)] rounded-lg text-[var(--pf-text-primary)] placeholder:text-[var(--pf-text-muted)] focus:outline-none focus:border-[var(--pf-accent-border)]"
          />
        </div>
        <div className="text-xs text-[var(--pf-text-muted)] flex justify-between px-1 mb-2">
          <span>合集</span>
          <span>地板价</span>
        </div>
        <div className="text-center text-xs text-[var(--pf-text-muted)] py-4">
          暂无合集
        </div>
      </CollapsibleSection>
    </div>
  );
}
