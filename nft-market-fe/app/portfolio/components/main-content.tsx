import {
  LayoutGrid, List, Grid3X3, Grid2X2, Edit3, X, ExternalLink, Clock,
  Search, SlidersHorizontal, ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { ListingDialog } from "./listingDailog"
import CollectionsApi from "@/api/collections"
import { useAccount } from "wagmi"
import { formatEther, parseEther } from "ethers"
import { SaleKind, Side, makeOrders } from "@/contracts/service/orderBookContract"
import { useEthersSigner } from "../../../hooks/useEthersSigner"
import { ImportNftPanel } from "./import-nft-panel"

type ViewSize = "lg" | "md" | "sm" | "list";

const VIEW_OPTIONS: { size: ViewSize; icon: React.ReactNode; cols: string }[] = [
  { size: "lg", icon: <Grid2X2 className="h-4 w-4" />, cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" },
  { size: "md", icon: <Grid3X3 className="h-4 w-4" />, cols: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5" },
  { size: "sm", icon: <LayoutGrid className="h-4 w-4" />, cols: "grid-cols-4 md:grid-cols-5 lg:grid-cols-6" },
  { size: "list", icon: <List className="h-4 w-4" />, cols: "" },
];

export function MainContent({
  tabIndex,
  myListOrders,
  myBids,
  myMatchedOrders,
  myItems,
  loadingListOrders,
  loadingBids,
  loadingMatchedOrders,
  loadingItems,
  onImportSuccess,
}: {
  tabIndex: number;
  myListOrders: any[];
  myBids: any[];
  myMatchedOrders: any[];
  myItems: any[];
  loadingListOrders: boolean;
  loadingBids: boolean;
  loadingMatchedOrders: boolean;
  loadingItems: boolean;
  onImportSuccess: () => Promise<void>;
}) {
  const [listingDialogOpen, setListingDialogOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [canListNfts, setCanListNfts] = useState<any[]>([]);
  const [myNfts, setMyNfts] = useState<any[]>([]);
  const [viewSize, setViewSize] = useState<ViewSize>("lg");
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isListing, setIsListing] = useState(false);
  const [listingStatus, setListingStatus] = useState<string>("");
  const [showImportForm, setShowImportForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recently_received");
  const { address, chainId } = useAccount();
  const signer = useEthersSigner();

  async function loadCollections() {
    // @ts-ignore
    const { result } = await CollectionsApi.GetCollections({
      limit: 100,
      range: "7d",
    });
    setCollections(result);
  }

  useEffect(() => {
    const normalizedNfts = (myItems || []).map((item: any) => ({
      tokenId: item.token_id,
      name: item.name || `${item.collection_name || "NFT"} #${item.token_id}`,
      description: "",
      image: {
        cachedUrl: item.image_uri || item.collection_image_uri || "https://www.metanode.tech/logo.png",
        originalUrl: item.image_uri || item.collection_image_uri || "https://www.metanode.tech/logo.png",
      },
      contract: {
        address: item.collection_address,
        name: item.collection_name || "Unknown Collection",
        symbol: "NFT",
      },
    }));
    setMyNfts(normalizedNfts);
  }, [myItems]);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    setCanListNfts(Array.isArray(myNfts) ? myNfts : []);
  }, [myNfts]);

  function closeListingDialog() {
    setListingDialogOpen(false);
  }

  const toggleNftSelection = (nftKey: string) => {
    const newSelected = new Set(selectedNfts);
    if (newSelected.has(nftKey)) {
      newSelected.delete(nftKey);
    } else {
      newSelected.add(nftKey);
    }
    setSelectedNfts(newSelected);
  };

  const updatePrice = (nftKey: string, price: string) => {
    setPrices((prev) => ({ ...prev, [nftKey]: price }));
  };

  const handleImageError = (nftKey: string) => {
    setImageErrors((prev) => new Set([...prev, nftKey]));
  };

  const handleBatchListing = async () => {
    if (!signer || !address) return;
    const selectedNftData = canListNfts
      .filter((nft) => selectedNfts.has(`${nft.contract.address}-${nft.tokenId}`))
      .map((nft) => ({
        ...nft,
        price: prices[`${nft.contract.address}-${nft.tokenId}`] || "0",
      }));

    const invalidPrices = selectedNftData.filter(
      (nft) => !nft.price || parseFloat(nft.price) <= 0
    );
    if (invalidPrices.length > 0) return;

    try {
      setIsListing(true);
      setListingStatus("准备创建订单...");
      const now = Math.floor(Date.now() / 1000) + 100000;
      const orders = selectedNftData.map((nft, index) => ({
        side: Side.List,
        saleKind: SaleKind.FixedPriceForItem,
        maker: address,
        nft: {
          tokenId: nft.tokenId,
          collection: nft.contract.address,
          amount: 1,
        },
        price: parseEther(nft.price),
        expiry: now,
        salt: Date.now() + index,
      }));
      setListingStatus("检查并授权NFT...");
      await makeOrders(signer, orders, { autoApprove: true });
      setSelectedNfts(new Set());
      setPrices({});
    } catch (error: any) {
      console.error("挂单失败:", error);
    } finally {
      setIsListing(false);
      setListingStatus("");
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}天前`;
    if (hrs > 0) return `${hrs}小时前`;
    if (mins > 0) return `${mins}分钟前`;
    return "刚刚";
  };

  const formatMatchedTime = (eventTime: number | string) => {
    const raw = Number(eventTime || 0);
    if (!raw) return "-";
    const ts = raw > 1_000_000_000_000 ? raw : raw * 1000;
    return new Date(ts).toLocaleString();
  };

  const currentView = VIEW_OPTIONS.find((v) => v.size === viewSize) || VIEW_OPTIONS[0];

  const renderLoadingSkeleton = () => (
    <div className={`grid ${currentView.cols || "grid-cols-4"} gap-3 animate-pulse`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[var(--pf-surface)] rounded-xl overflow-hidden border border-[var(--pf-border)]">
          <div className="aspect-square bg-[var(--pf-surface-strong)]" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-[var(--pf-surface-strong)] rounded w-3/4" />
            <div className="h-3 bg-[var(--pf-surface-strong)] rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (emoji: string, title: string, subtitle: string) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-lg font-semibold text-[var(--pf-text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--pf-text-muted)]">{subtitle}</p>
    </div>
  );

  const renderNftCard = (nft: any, isSelected: boolean, nftKey: string) => {
    if (viewSize === "list") {
      return (
        <div
          key={nftKey}
          onClick={() => toggleNftSelection(nftKey)}
          className={`flex items-center gap-4 px-4 py-3 border-b border-[var(--pf-border)] hover:bg-white/[0.02] cursor-pointer transition-colors ${
            isSelected ? "bg-[var(--pf-accent-soft)]" : ""
          }`}
        >
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--pf-surface-strong)] shrink-0">
            {!imageErrors.has(nftKey) ? (
              <img
                src={nft.image?.cachedUrl || nft.image?.originalUrl}
                alt={nft.name}
                className="w-full h-full object-cover"
                onError={() => handleImageError(nftKey)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg">🖼️</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--pf-text-primary)] truncate">{nft.name}</div>
            <div className="text-xs text-[var(--pf-text-muted)]">{nft.contract.name}</div>
          </div>
          <div className="w-32">
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="价格"
              value={prices[nftKey] || ""}
              onChange={(e) => updatePrice(nftKey, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-xs bg-[var(--pf-surface)] border-[var(--pf-border-soft)] text-[var(--pf-text-primary)]"
            />
          </div>
          {isSelected && (
            <div className="w-5 h-5 bg-[var(--pf-accent)] rounded-full flex items-center justify-center shrink-0">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={nftKey}
        onClick={() => toggleNftSelection(nftKey)}
        className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all group ${
          isSelected
            ? "border-[var(--pf-accent-border)] shadow-[0_0_0_1px_var(--pf-accent-border)]"
            : "border-[var(--pf-border)] hover:border-[var(--pf-border-strong)] hover:shadow-lg"
        } bg-[var(--pf-surface)]`}
      >
        <div className="aspect-square relative overflow-hidden bg-[var(--pf-surface-strong)]">
          {!imageErrors.has(nftKey) ? (
            <img
              src={nft.image?.cachedUrl || nft.image?.originalUrl}
              alt={nft.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => handleImageError(nftKey)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🖼️</div>
          )}
          {isSelected && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-[var(--pf-accent)] rounded-full flex items-center justify-center shadow">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="text-xs text-[var(--pf-text-muted)] truncate">{nft.contract.name}</div>
          <div className="text-sm font-medium text-[var(--pf-text-primary)] truncate mt-0.5">
            {nft.name || `#${nft.tokenId}`}
          </div>
          <div className="mt-2">
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="价格 (ETH)"
              value={prices[nftKey] || ""}
              onChange={(e) => updatePrice(nftKey, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="h-7 text-xs bg-[var(--pf-surface-soft)] border-[var(--pf-border-soft)] text-[var(--pf-text-primary)] placeholder:text-[var(--pf-text-muted)]"
            />
          </div>
        </div>
      </div>
    );
  };

  const filteredNfts = canListNfts.filter((nft) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (nft.name || "").toLowerCase().includes(q) ||
      (nft.contract?.name || "").toLowerCase().includes(q) ||
      String(nft.tokenId).includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ListingDialog
        canListNfts={canListNfts}
        collections={collections}
        open={listingDialogOpen}
        close={closeListingDialog}
      />

      {/* ── 库存 tab ── */}
      {tabIndex === 0 && (
        <div className="flex-1 flex flex-col">
          {/* 顶部工具栏 */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--pf-border)]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--pf-text-muted)]" />
              <input
                type="text"
                placeholder="搜索物品"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--pf-surface)] border border-[var(--pf-border)] rounded-xl text-[var(--pf-text-primary)] placeholder:text-[var(--pf-text-muted)] focus:outline-none focus:border-[var(--pf-border-strong)]"
              />
            </div>

            <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--pf-text-secondary)] bg-[var(--pf-surface)] border border-[var(--pf-border)] rounded-xl hover:border-[var(--pf-border-strong)] transition-colors">
              最近获得
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center border border-[var(--pf-border)] rounded-xl overflow-hidden bg-[var(--pf-surface)]">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.size}
                  onClick={() => setViewSize(opt.size)}
                  className={`p-2 transition-colors ${
                    viewSize === opt.size
                      ? "bg-[var(--pf-surface-strong)] text-[var(--pf-text-primary)]"
                      : "text-[var(--pf-text-muted)] hover:text-[var(--pf-text-secondary)]"
                  }`}
                >
                  {opt.icon}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => setShowImportForm((prev) => !prev)}
              className="bg-[var(--pf-accent)] hover:bg-[var(--pf-accent-strong)] text-white rounded-xl"
            >
              导入 NFT
            </Button>
          </div>

          {/* 数量指示 */}
          <div className="px-6 py-2 text-xs text-[var(--pf-text-muted)] border-b border-[var(--pf-border)]">
            {filteredNfts.length} 个物品
          </div>

          {/* 导入面板 */}
          <ImportNftPanel
            visible={showImportForm}
            address={address}
            chainId={chainId}
            myItems={myItems}
            onClose={() => setShowImportForm(false)}
            onImported={onImportSuccess}
          />

          {/* NFT 网格 */}
          <div className="flex-1 overflow-auto p-4">
            {loadingItems ? (
              renderLoadingSkeleton()
            ) : filteredNfts.length === 0 ? (
              renderEmptyState("🎨", "暂无物品", "导入 NFT 或调整筛选条件")
            ) : viewSize === "list" ? (
              <div className="border border-[var(--pf-border)] rounded-xl overflow-hidden">
                {filteredNfts.map((nft) => {
                  const nftKey = `${nft.contract.address}-${nft.tokenId}`;
                  return renderNftCard(nft, selectedNfts.has(nftKey), nftKey);
                })}
              </div>
            ) : (
              <div className={`grid ${currentView.cols} gap-3`}>
                {filteredNfts.map((nft) => {
                  const nftKey = `${nft.contract.address}-${nft.tokenId}`;
                  return renderNftCard(nft, selectedNfts.has(nftKey), nftKey);
                })}
              </div>
            )}
          </div>

          {/* 底部操作栏 (OpenSea 风格) */}
          <div className="border-t border-[var(--pf-border)] bg-[var(--pf-bg-main)] px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={selectedNfts.size === 0 || isListing}
                onClick={handleBatchListing}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50"
              >
                {isListing ? listingStatus || "挂单中..." : "批量挂单"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[var(--pf-border)] text-[var(--pf-text-secondary)] rounded-xl hover:bg-[var(--pf-surface)]"
              >
                取消挂单
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-[var(--pf-border)] text-[var(--pf-text-secondary)] rounded-xl hover:bg-[var(--pf-surface)]"
              >
                接受报价
              </Button>
            </div>
            <div className="flex items-center gap-1 text-[var(--pf-text-muted)]">
              {selectedNfts.size > 0 && (
                <span className="text-xs mr-2">已选 {selectedNfts.size} 个</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 挂单记录 tab ── */}
      {tabIndex === 1 && (
        <div className="flex-1 overflow-auto p-6">
          {loadingListOrders ? (
            renderLoadingSkeleton()
          ) : myListOrders.length === 0 ? (
            renderEmptyState("📝", "暂无挂单记录", "去库存页面挂单出售您的 NFT")
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {myListOrders.map((order) => {
                let priceStr = "0 ETH";
                try {
                  priceStr = `${parseFloat(formatEther(order.price || "0")).toFixed(4)} ETH`;
                } catch {}
                return (
                  <div
                    key={order.collection_address + order.token_id}
                    className="bg-[var(--pf-surface)] rounded-xl overflow-hidden border border-[var(--pf-border)] hover:border-[var(--pf-border-strong)] transition-all group"
                  >
                    <div className="aspect-square overflow-hidden bg-[var(--pf-surface-strong)] relative">
                      <img
                        src={order.collection_image_uri || order.item_image_uri || "https://www.metanode.tech/logo.png"}
                        alt={order.item_name || "NFT"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = "https://www.metanode.tech/logo.png";
                        }}
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/80 text-white text-[10px] rounded-full font-medium">
                        已挂单
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div>
                        <div className="text-xs text-[var(--pf-text-muted)] truncate">{order.collection_name}</div>
                        <div className="text-sm font-medium text-[var(--pf-text-primary)] truncate">
                          {order.item_name || `#${order.token_id}`}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--pf-text-muted)]">价格</span>
                        <span className="text-sm font-semibold text-[var(--pf-text-primary)]">{priceStr}</span>
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs border-[var(--pf-border)] text-[var(--pf-text-secondary)] hover:bg-[var(--pf-surface-strong)] rounded-lg"
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs border-red-600/40 text-red-400 hover:bg-red-600/10 rounded-lg"
                        >
                          <X className="h-3 w-3 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 出价记录 tab ── */}
      {tabIndex === 2 && (
        <div className="flex-1 overflow-auto p-6">
          {loadingBids ? (
            renderLoadingSkeleton()
          ) : myBids.length === 0 ? (
            renderEmptyState("💰", "暂无出价记录", "您还没有发起任何买单")
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {myBids.map((bid, idx) => {
                const price = Number(bid?.bid_price || 0) / 1e18;
                const expireMs = Number(bid?.expire_time || 0) * 1000;
                const isExpired = expireMs > 0 ? Date.now() > expireMs : false;
                return (
                  <div
                    key={`${bid.collection_address}-${bid.token_id}-${idx}`}
                    className="bg-[var(--pf-surface)] rounded-xl overflow-hidden border border-[var(--pf-border)] hover:border-[var(--pf-border-strong)] transition-all group"
                  >
                    <div className="aspect-square overflow-hidden bg-[var(--pf-surface-strong)] relative">
                      <img
                        src={bid.image_uri || "https://www.metanode.tech/logo.png"}
                        alt={bid.collection_name || "collection"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://www.metanode.tech/logo.png";
                        }}
                      />
                      <span
                        className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] rounded-full font-medium ${
                          isExpired ? "bg-red-500/80 text-white" : "bg-violet-500/80 text-white"
                        }`}
                      >
                        {isExpired ? "已过期" : "活跃"}
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div>
                        <div className="text-xs text-[var(--pf-text-muted)] truncate">
                          {bid.collection_name || "未知合集"}
                        </div>
                        <div className="text-sm font-medium text-[var(--pf-text-primary)] truncate">
                          {bid.token_id ? `#${bid.token_id}` : "合集出价"}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--pf-text-muted)]">出价</span>
                        <span className="text-sm font-semibold text-[var(--pf-text-primary)]">
                          {price > 0 ? `${price.toFixed(4)} ETH` : "0 ETH"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--pf-text-muted)]">数量</span>
                        <span className="text-xs text-[var(--pf-text-secondary)]">{bid.order_size || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 成交记录 tab ── */}
      {tabIndex === 3 && (
        <div className="flex-1 overflow-auto p-6">
          {loadingMatchedOrders ? (
            renderLoadingSkeleton()
          ) : myMatchedOrders.length === 0 ? (
            renderEmptyState("📈", "暂无成交记录", "您的成交订单将显示在这里")
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {myMatchedOrders.map((matched, idx) => {
                const imageUri =
                  matched?.item_image_uri || matched?.collection_image_uri || "https://www.metanode.tech/logo.png";
                let matchedPrice = "0 ETH";
                try {
                  matchedPrice = `${parseFloat(formatEther(matched?.price || "0")).toFixed(4)} ETH`;
                } catch {}
                return (
                  <div
                    key={`${matched?.tx_hash || "tx"}-${matched?.token_id || "c"}-${idx}`}
                    className="bg-[var(--pf-surface)] rounded-xl overflow-hidden border border-[var(--pf-border)] hover:border-[var(--pf-border-strong)] transition-all group"
                  >
                    <div className="aspect-square overflow-hidden bg-[var(--pf-surface-strong)] relative">
                      <img
                        src={imageUri}
                        alt="NFT"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://www.metanode.tech/logo.png";
                        }}
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/80 text-white text-[10px] rounded-full font-medium">
                        已售
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div>
                        <div className="text-xs text-[var(--pf-text-muted)] truncate">
                          {matched?.collection_name || "未知合集"}
                        </div>
                        <div className="text-sm font-medium text-[var(--pf-text-primary)] truncate">
                          {matched?.item_name || (matched?.token_id ? `#${matched.token_id}` : "交易")}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--pf-text-muted)]">成交价</span>
                        <span className="text-sm font-semibold text-[var(--pf-text-primary)]">{matchedPrice}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--pf-text-muted)]">时间</span>
                        <span className="text-xs text-[var(--pf-text-secondary)]">
                          {formatMatchedTime(matched?.event_time)}
                        </span>
                      </div>
                      {matched?.tx_hash && (
                        <button
                          onClick={() =>
                            window.open(`https://sepolia.etherscan.io/tx/${matched.tx_hash}`, "_blank")
                          }
                          className="flex items-center gap-1 text-xs text-[var(--pf-text-muted)] hover:text-[var(--pf-text-primary)] pt-1 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          在 Etherscan 查看
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Activity tab ── */}
      {tabIndex === 4 && (
        <div className="flex-1 overflow-auto p-6">
          {renderEmptyState("📋", "动态", "您的近期活动将显示在这里")}
        </div>
      )}
    </div>
  );
}
