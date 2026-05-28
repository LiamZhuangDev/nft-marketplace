"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type MarketHeroProps = {
  collections: any[];
  loading?: boolean;
};

const FALLBACK_IMAGE_URL = "https://www.metanode.tech/logo.png";
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m3u8"];

function isVideoBanner(uri: string): boolean {
  const normalized = String(uri || "").toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => normalized.includes(ext));
}

function formatEth(value: any) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  if (num === 0) return "0";
  if (num < 0.01) return num.toFixed(4);
  return num.toFixed(2);
}

export default function MarketHero({ collections, loading }: MarketHeroProps) {
  const [active, setActive] = useState(0);

  const slides = useMemo(() => {
    return (collections || [])
      .filter((item) => item?.address)
      .slice(0, 5)
      .map((item) => ({
        id: item.address,
        name: item.name || "Unknown Collection",
        banner: item.banner || item.banner_uri || "",
        image: item.image_uri || FALLBACK_IMAGE_URL,
        floor: formatEth(item.floor_price),
        volume: formatEth(item.item_sold),
        items: item.item_num || 0,
        change: Number(item.floor_price_change || 0),
      }));
  }, [collections]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 px-6 pt-6">
        <div className="h-[320px] rounded-2xl bg-gray-800 animate-pulse" />
        <div className="h-[320px] rounded-2xl bg-gray-800 animate-pulse" />
      </div>
    );
  }

  if (slides.length === 0) return null;

  const current = slides[active];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 px-6 pt-6">
      <div className="relative h-min-[320px] rounded-2xl overflow-hidden border border-gray-800 bg-black/30">
        {current.banner && isVideoBanner(current.banner) ? (
          <video
            src={current.banner}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={current.banner || current.image}
            alt={current.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_IMAGE_URL;
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        <div className="absolute left-0 right-0 bottom-0 p-6">
          <h2 className="text-3xl font-semibold text-white">{current.name}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
            <div className="rounded-lg bg-black/40 border border-white/10 p-3">
              <div className="text-[11px] text-gray-300">地板价</div>
              <div className="text-sm font-medium text-white">{current.floor} ETH</div>
            </div>
            <div className="rounded-lg bg-black/40 border border-white/10 p-3">
              <div className="text-[11px] text-gray-300">24h成交</div>
              <div className="text-sm font-medium text-white">{current.volume} ETH</div>
            </div>
            <div className="rounded-lg bg-black/40 border border-white/10 p-3">
              <div className="text-[11px] text-gray-300">藏品数</div>
              <div className="text-sm font-medium text-white">{current.items}</div>
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActive((prev) => (prev - 1 + slides.length) % slides.length)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={() => setActive((prev) => (prev + 1) % slides.length)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`h-1.5 rounded-full transition-all ${
                    idx === active ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/70"
                  }`}
                  onClick={() => setActive(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#0e1118] p-4">
        <div className="text-sm font-medium text-white mb-4">热门榜单</div>
        <div className="space-y-2">
          {slides.map((item, idx) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-400 w-4">{idx + 1}</span>
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-8 h-8 rounded-md object-cover"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMAGE_URL;
                  }}
                />
                <span className="text-sm text-white truncate">{item.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-white">{item.floor} ETH</div>
                <div className={`text-xs ${item.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {item.change >= 0 ? "+" : ""}
                  {item.change.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

