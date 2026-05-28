import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import portfolioApi from "@/api/portfolio";
import { getCOSToken, uploadFileToCOS } from "@/lib/cos-upload";

type ImportNftPanelProps = {
  visible: boolean;
  address?: string;
  chainId?: number;
  myItems: any[];
  onClose: () => void;
  onImported: () => Promise<void>;
};

const DEFAULT_LOGO = "https://www.metanode.tech/logo.png";
const ALCHEMY_API_KEY = "8N8LPq7eV1mZPWkArtwvWHHB-EnADbER";

export function ImportNftPanel({
  visible,
  address,
  chainId,
  myItems,
  onClose,
  onImported,
}: ImportNftPanelProps) {
  const [importing, setImporting] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const toDecimalTokenId = (tokenIdRaw: string | number) => {
    const tokenId = String(tokenIdRaw || "");
    if (!tokenId) return "";
    if (tokenId.startsWith("0x")) {
      try {
        return BigInt(tokenId).toString();
      } catch {
        return tokenId;
      }
    }
    return tokenId;
  };

  const buildImportKey = (collectionAddress: string, tokenId: string | number) =>
    `${String(collectionAddress || "").toLowerCase()}-${toDecimalTokenId(tokenId)}`;

  const importedSet = useMemo(
    () => new Set((myItems || []).map((it: any) => buildImportKey(it.collection_address, it.token_id))),
    [myItems],
  );

  const loadCandidates = async () => {
    if (!address) return;
    setLoadingCandidates(true);
    try {
      const chainToAlchemyNetwork: Record<number, string> = {
        11155111: "eth-sepolia",
        1: "eth-mainnet",
      };
      const network = chainToAlchemyNetwork[chainId || 11155111] || "eth-sepolia";
      const url = `https://${network}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner?owner=${address}&pageSize=100`;
      const response = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const data = await response.json();
      setCandidates(Array.isArray(data?.ownedNfts) ? data.ownedNfts : []);
    } catch (error) {
      console.error("获取可导入NFT失败:", error);
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (visible && address) {
      void loadCandidates();
    }
  }, [visible, address, chainId]);

  const toggleSelection = (importKey: string) => {
    const next = new Set(selectedKeys);
    if (next.has(importKey)) {
      next.delete(importKey);
    } else {
      next.add(importKey);
    }
    setSelectedKeys(next);
  };

  const selectAll = () => {
    const allKeys = candidates
      .map((nft) => buildImportKey(nft?.contract?.address, nft?.tokenId))
      .filter((key) => key && !importedSet.has(key));
    setSelectedKeys(new Set(allKeys));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const dataUriToFile = (dataUri: string, fallbackName: string) => {
    const matched = dataUri.match(/^data:(.*?);base64,(.*)$/);
    if (!matched) throw new Error("invalid data URI");
    const mimeType = matched[1] || "application/octet-stream";
    const base64Data = matched[2];
    const byteChars = atob(base64Data);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const extensionMap: Record<string, string> = {
      "image/svg+xml": "svg",
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extensionMap[mimeType] || "bin";
    return new File([byteArray], `${fallbackName}.${ext}`, { type: mimeType });
  };

  const resolveImageURIForImport = async (nft: any, index: number) => {
    const imageURI = nft?.image?.cachedUrl || nft?.image?.originalUrl || "";
    if (!imageURI) return DEFAULT_LOGO;
    if (/^data:/i.test(imageURI)) {
      try {
        const tokenId = toDecimalTokenId(nft?.tokenId || index);
        const file = dataUriToFile(imageURI, `import_${Date.now()}_${tokenId}`);
        const tokenResp = await getCOSToken("image", file.name, file.size);
        const cosUrl = await uploadFileToCOS(file, tokenResp.result);
        return /^data:/i.test(cosUrl) ? DEFAULT_LOGO : (cosUrl || DEFAULT_LOGO);
      } catch (error) {
        console.error("base64 图片上传 COS 失败:", error);
        return DEFAULT_LOGO;
      }
    }
    return /^data:/i.test(imageURI) ? DEFAULT_LOGO : imageURI;
  };

  const handleBatchImport = async () => {
    if (!address) {
      alert("请先连接钱包");
      return;
    }
    if (selectedKeys.size === 0) {
      alert("请先选择要导入的NFT");
      return;
    }

    try {
      setImporting(true);
      const selected = candidates.filter((nft) => {
        const importKey = buildImportKey(nft?.contract?.address, nft?.tokenId);
        return selectedKeys.has(importKey);
      });

      const tasks = selected.map(async (nft, index) => {
        const logoURI = await resolveImageURIForImport(nft, index);
        return portfolioApi.ImportPortfolioItem({
          chain_id: chainId || 11155111,
          user_address: address,
          collection_address: nft?.contract?.address,
          token_id: toDecimalTokenId(nft?.tokenId),
          logo_uri: logoURI,
        });
      });

      const result = await Promise.allSettled(tasks);
      const successCount = result.filter((item) => item.status === "fulfilled").length;
      const failCount = result.length - successCount;

      await onImported();
      setSelectedKeys(new Set());
      onClose();
      alert(`导入完成：成功 ${successCount} 个，失败 ${failCount} 个`);
    } catch (error) {
      console.error("导入NFT失败:", error);
      alert("导入失败，请稍后重试");
    } finally {
      setImporting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 p-4 border border-[var(--pf-border-soft)] rounded-xl bg-[var(--pf-surface-translucent)] backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">选择要导入的NFT（Alchemy自动读取当前钱包）</h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-surface-strong)]"
            disabled={loadingCandidates || candidates.length === 0}
          >
            全选
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className="text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-surface-strong)]"
            disabled={selectedKeys.size === 0}
          >
            清空
          </Button>
        </div>
      </div>

      {loadingCandidates ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-pulse">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={`import-loading-${idx}`} className="rounded-lg border border-[var(--pf-border-soft)] p-2 bg-[var(--pf-surface-muted)]">
              <div className="aspect-square rounded bg-[var(--pf-surface-strong)]" />
              <div className="h-3 bg-[var(--pf-surface-strong)] rounded mt-2" />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-sm text-[var(--pf-text-muted)] py-4">当前地址未查询到可导入NFT</div>
      ) : (
        <div className="max-h-80 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pr-1">
          {candidates.map((nft) => {
            const collectionAddress = nft?.contract?.address || "";
            const tokenId = toDecimalTokenId(nft?.tokenId);
            const importKey = buildImportKey(collectionAddress, tokenId);
            const isSelected = selectedKeys.has(importKey);
            const alreadyImported = importedSet.has(importKey);
            return (
              <button
                key={importKey}
                type="button"
                disabled={alreadyImported}
                onClick={() => toggleSelection(importKey)}
                className={`text-left rounded-lg border p-2 transition-all ${
                  alreadyImported
                    ? "border-[var(--pf-border-soft)] bg-[var(--pf-surface-elevated)] opacity-60 cursor-not-allowed"
                    : isSelected
                      ? "border-[var(--pf-accent-border)] bg-[var(--pf-accent-soft)]"
                      : "border-[var(--pf-border-soft)] bg-[var(--pf-surface-muted)] hover:border-[var(--pf-accent-border-faint)]"
                }`}
              >
                <div className="aspect-square rounded overflow-hidden bg-[var(--pf-surface-strong)]">
                  <img
                    src={nft?.image?.cachedUrl || nft?.image?.originalUrl || DEFAULT_LOGO}
                    alt={nft?.name || `#${tokenId}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_LOGO;
                    }}
                  />
                </div>
                <div className="mt-2">
                  <div className="text-xs text-white truncate">{nft?.name || `#${tokenId}`}</div>
                  <div className="text-[11px] text-[var(--pf-text-muted)] truncate">#{tokenId}</div>
                  {alreadyImported && <div className="text-[10px] text-emerald-300 mt-1">已在库存</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex gap-2 items-center">
        <Button
          onClick={handleBatchImport}
          disabled={importing}
          className="bg-[var(--pf-accent)] hover:bg-[var(--pf-accent-strong)] text-slate-950"
        >
          {importing ? "批量导入中..." : `批量导入 (${selectedKeys.size})`}
        </Button>
        <Button variant="ghost" onClick={onClose} className="text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-surface-strong)]">
          取消
        </Button>
        <Button
          variant="ghost"
          onClick={loadCandidates}
          className="text-[var(--pf-text-secondary)] hover:text-[var(--pf-text-primary)] hover:bg-[var(--pf-surface-strong)]"
          disabled={loadingCandidates}
        >
          刷新列表
        </Button>
      </div>
    </div>
  );
}

