"use client";

import { formatUnits } from "ethers";
import { useState } from "react";
import { ExternalLink, ShoppingCart } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { formatAddress, getNftExplorerUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlaceItemBidDialog } from "./place-item-bid-dialog";
import { buyNowWithMulticall } from "@/contracts/service/orderBookContract";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useAccount } from "wagmi";

const ETH_DECIMALS = 18;
const FALLBACK_IMG = "https://www.metanode.tech/_next/image?url=%2Flogo.png&w=256&q=75";

interface Item {
  name: string;
  image_uri: string;
  token_id: string;
  collection_address: string;
  owner_address: string;
  list_price: string;
  bid_price: string;
  last_sell_price: string;
  list_order_id: string;
  bid_order_id: string;
  owner_owned_amount: number;
  rarity_rank?: number;
  [key: string]: any;
}

interface ItemsGridProps {
  items: Item[];
  chainId?: string | number;
  gridCols?: string;
  viewSize?: string;
}

function formatPrice(price: string, decimals = ETH_DECIMALS): string {
  if (!price || price === "0") return "";
  try {
    const ethValue = formatUnits(price, decimals);
    const num = parseFloat(ethValue);
    if (num === 0) return "";
    const str = num >= 1 ? num.toFixed(2) : num >= 0.01 ? num.toFixed(4) : num.toFixed(6);
    return str.replace(/\.?0+$/, "");
  } catch {
    return "";
  }
}

export function ItemsGrid({
  items,
  chainId = 11155111,
  gridCols = "grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
  viewSize = "md",
}: ItemsGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const signer = useEthersSigner();
  const { address } = useAccount();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [buyingKeys, setBuyingKeys] = useState<Set<string>>(new Set());

  const handleImageError = (itemKey: string) => {
    setImageErrors((prev) => new Set(prev).add(itemKey));
  };

  const handleBuyNow = async (e: React.MouseEvent, item: Item, itemKey: string) => {
    e.stopPropagation();
    if (!signer || !address) return;
    try {
      setBuyingKeys((prev) => new Set(prev).add(itemKey));
      await buyNowWithMulticall(signer, {
        collection: item.collection_address,
        tokenId: item.token_id,
      });
    } catch (error: any) {
      console.error("购买失败:", error);
    } finally {
      setBuyingKeys((prev) => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-3">🎨</div>
        <h3 className="text-lg font-semibold text-foreground mb-1">暂无物品</h3>
        <p className="text-sm text-muted-foreground">试试调整筛选条件</p>
      </div>
    );
  }

  // ── List View ──
  if (viewSize === "list") {
    return (
      <>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_120px_120px_120px_100px] gap-4 px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border bg-muted/30">
            <span />
            <span>物品</span>
            <span className="text-right">价格</span>
            <span className="text-right">最高出价</span>
            <span className="text-right">最近成交</span>
            <span className="text-right">持有者</span>
          </div>
          {items.map((item) => {
            const itemKey = `${item.collection_address}-${item.token_id}`;
            const hasImageError = imageErrors.has(itemKey);
            const listP = formatPrice(item.list_price);
            const bidP = formatPrice(item.bid_price);
            const lastP = formatPrice(item.last_sell_price);

            return (
              <div
                key={itemKey}
                onClick={() => router.push(`${pathname}/${item.token_id}`)}
                className="grid grid-cols-[48px_1fr_120px_120px_120px_100px] gap-4 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/50 cursor-pointer transition-colors items-center"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img
                    src={!hasImageError && item.image_uri ? item.image_uri : FALLBACK_IMG}
                    alt={item.name || `#${item.token_id}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(itemKey)}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {item.name || `#${item.token_id}`}
                  </div>
                </div>
                <div className="text-right text-sm font-medium text-foreground">
                  {listP ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      {listP}
                      <img src="/eth.svg" alt="ETH" className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-right text-sm text-blue-400">
                  {bidP ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      {bidP}
                      <img src="/eth.svg" alt="ETH" className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {lastP ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      {lastP}
                      <img src="/eth.svg" alt="ETH" className="w-4 h-4" />
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground font-mono">
                  {formatAddress(item.owner_address)}
                </div>
              </div>
            );
          })}
        </div>

        {selectedItem && (
          <PlaceItemBidDialog
            open={bidDialogOpen}
            close={() => { setBidDialogOpen(false); setSelectedItem(null); }}
            collectionAddress={selectedItem.collection_address}
            tokenId={selectedItem.token_id}
            itemName={selectedItem.name}
            itemImage={selectedItem.image_uri}
          />
        )}
      </>
    );
  }

  // ── Grid View ──
  return (
    <>
      <div className={`grid ${gridCols} gap-3`}>
        {items.map((item) => {
          const itemKey = `${item.collection_address}-${item.token_id}`;
          const hasImageError = imageErrors.has(itemKey);
          const isBuying = buyingKeys.has(itemKey);
          const listP = formatPrice(item.list_price);
          const bidP = formatPrice(item.bid_price);
          const lastP = formatPrice(item.last_sell_price);
          const displayPrice = listP || lastP;

          return (
            <div
              key={itemKey}
              onClick={() => router.push(`${pathname}/${item.token_id}`)}
              className="group rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer"
            >
              {/* 图片 */}
              <div className="aspect-square w-full relative bg-muted overflow-hidden">
                <img
                  src={!hasImageError && item.image_uri ? item.image_uri : FALLBACK_IMG}
                  alt={item.name || `Token #${item.token_id}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => handleImageError(itemKey)}
                />
                {/* Hover 操作区 */}
                <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-gradient-to-t from-black/80 to-transparent p-2 flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={(e) => handleBuyNow(e, item, itemKey)}
                    disabled={isBuying}
                    className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    {isBuying ? "购买中..." : "购买"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem(item);
                      setBidDialogOpen(true);
                    }}
                    className="h-8 text-xs border-white/30 text-white hover:bg-white/10 rounded-lg"
                  >
                    出价
                  </Button>
                </div>
                {/* 浏览器链接 */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 w-7 p-0 bg-background/70 backdrop-blur-sm hover:bg-background/90 rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(
                        getNftExplorerUrl(chainId, item.collection_address, item.token_id),
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* 信息区 */}
              <div className="p-3 space-y-1.5">
                <div className="text-xs text-muted-foreground truncate">
                  #{item.token_id}
                  {item.rarity_rank && item.rarity_rank > 0 && (
                    <span className="ml-2 text-primary">稀有度 #{item.rarity_rank}</span>
                  )}
                </div>
                <div className="text-sm font-medium text-foreground truncate">
                  {item.name || `Token #${item.token_id}`}
                </div>

                {/* 价格行 */}
                <div className="flex items-center justify-between pt-1.5">
                  <div>
                    {displayPrice ? (
                      <div className="flex items-center gap-1">
                        <img src="/eth.svg" alt="ETH" className="w-4 h-4" />
                        <span className="text-sm font-semibold text-foreground">{displayPrice}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {listP && <div className="text-[10px] text-muted-foreground mt-0.5">挂单价</div>}
                    {!listP && lastP && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">最近成交</div>
                    )}
                  </div>
                  {bidP && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <img src="/eth.svg" alt="ETH" className="w-3.5 h-3.5 opacity-60" />
                        <span className="text-xs text-blue-400">{bidP}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">最高出价</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <PlaceItemBidDialog
          open={bidDialogOpen}
          close={() => { setBidDialogOpen(false); setSelectedItem(null); }}
          collectionAddress={selectedItem.collection_address}
          tokenId={selectedItem.token_id}
          itemName={selectedItem.name}
          itemImage={selectedItem.image_uri}
        />
      )}
    </>
  );
}
