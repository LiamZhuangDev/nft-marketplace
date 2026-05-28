import { ArrowDown, ArrowUp, ArrowUpDown, BadgeCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { useGlobalState } from "@/hooks/useGlobalState";
import { useMemo, useState } from "react";

type CollectionProps = {
  collections: any[];
  loading?: boolean;
};

const FALLBACK_IMAGE_URL = "https://www.metanode.tech/_next/image?url=%2Flogo.png&w=256&q=75";

function hideAddress(address: string) {
  return address?.slice(0, 6) + '...' + address?.slice(-4);
}

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatEth(value: any): string {
  const n = toNumber(value);
  if (n === 0) return "0";
  if (n < 0.01) return n.toFixed(4);
  return n.toFixed(2);
}

function formatPercent(value: any): string {
  const n = toNumber(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

type SortKey = "name" | "floor" | "change1d" | "volume1d" | "volume7d" | "owners" | "items";

export function CollectionsTable({ collections, loading }: CollectionProps) {
  const router = useRouter();
  const { setState } = useGlobalState();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("volume1d");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleImageError = (address: string) => {
    setImageErrors((prev) => new Set(prev).add(address));
  };

  const sortedCollections = useMemo(() => {
    const items = Array.isArray(collections) ? [...collections] : [];
    items.sort((a, b) => {
      if (sortKey === "name") {
        const av = String(a?.name || "").toLowerCase();
        const bv = String(b?.name || "").toLowerCase();
        const res = av.localeCompare(bv);
        return sortOrder === "asc" ? res : -res;
      }
      const valueByKey = (item: any, key: SortKey) => {
        switch (key) {
          case "floor":
            return toNumber(item?.floor_price);
          case "change1d":
            return toNumber(item?.floor_price_change);
          case "volume1d":
            return toNumber(item?.item_sold);
          case "volume7d":
            return toNumber(item?.item_sold_7d ?? item?.item_sold);
          case "owners":
            return toNumber(item?.owner_num ?? item?.owner_count);
          case "items":
            return toNumber(item?.item_num);
          default:
            return 0;
        }
      };
      const res = valueByKey(a, sortKey) - valueByKey(b, sortKey);
      return sortOrder === "asc" ? res : -res;
    });
    return items;
  }, [collections, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortOrder("desc");
  };

  const renderSortableHead = (label: string, key: SortKey) => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 transition-colors ${
          active ? "text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        <span>{label}</span>
        {active ? (
          sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
        )}
      </button>
    );
  };

  return (
    <div className="px-6 py-4">
      <div className="rounded-xl border border-gray-800 bg-[#0f131d] overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="h-12 border-gray-800 bg-[#121826] whitespace-nowrap">
                <TableHead className="w-[64px] sticky left-0 z-10 bg-[#121826] text-gray-400">#</TableHead>
                <TableHead className="w-[300px]">{renderSortableHead("Collection", "name")}</TableHead>
                <TableHead className="w-[130px]">{renderSortableHead("Floor", "floor")}</TableHead>
                <TableHead className="w-[130px]">{renderSortableHead("24h %", "change1d")}</TableHead>
                <TableHead className="w-[140px]">{renderSortableHead("24h Volume", "volume1d")}</TableHead>
                <TableHead className="w-[140px]">{renderSortableHead("7d Volume", "volume7d")}</TableHead>
                <TableHead className="w-[140px]">{renderSortableHead("Owners", "owners")}</TableHead>
                <TableHead className="w-[120px]">{renderSortableHead("Items", "items")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`} className="h-[74px] border-gray-800">
                      <TableCell className="sticky left-0 z-10 bg-[#0f131d]">
                        <div className="h-4 w-5 bg-gray-700 rounded animate-pulse" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-gray-700 animate-pulse" />
                          <div className="h-4 w-28 bg-gray-700 rounded animate-pulse" />
                        </div>
                      </TableCell>
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <TableCell key={`skeleton-cell-${index}-${idx}`}>
                          <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : sortedCollections.map((collection, idx) => {
                    const change = toNumber(collection.floor_price_change);
                    const ownerCount = toNumber(collection.owner_num ?? collection.owner_count);
                    return (
                      <TableRow
                        key={collection.address}
                        className="h-[74px] border-gray-800 hover:bg-white/[0.04] cursor-pointer"
                        onClick={() => {
                          setState({
                            chain_id: collection.chain_id,
                            collection_address: collection.address,
                          });
                          router.push(`/collections/${encodeURIComponent(collection.address)}`);
                        }}
                      >
                        <TableCell className="sticky left-0 z-10 bg-[#0f131d] text-gray-300 font-medium">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              className="w-10 h-10 rounded-md object-cover"
                              src={!imageErrors.has(collection.address) && collection.image_uri ? collection.image_uri : FALLBACK_IMAGE_URL}
                              alt={collection.name}
                              onError={() => handleImageError(collection.address)}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-white truncate font-medium">
                                  {collection.name || "Unknown Collection"}
                                </span>
                                <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0" />
                              </div>
                              <span className="text-xs text-gray-400">{hideAddress(collection.address || "")}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{formatEth(collection.floor_price)} ETH</TableCell>
                        <TableCell className={change >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {formatPercent(change)}
                        </TableCell>
                        <TableCell className="text-white">{formatEth(collection.item_sold)} ETH</TableCell>
                        <TableCell className="text-white">{formatEth(collection.item_sold_7d ?? collection.item_sold)} ETH</TableCell>
                        <TableCell className="text-gray-200">{ownerCount > 0 ? ownerCount.toLocaleString() : "-"}</TableCell>
                        <TableCell className="text-gray-200">{toNumber(collection.item_num).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
