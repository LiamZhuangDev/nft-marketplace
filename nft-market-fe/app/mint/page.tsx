"use client";

import { useState, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Wallet,
  RotateCcw,
} from "lucide-react";
import {
  getCOSToken,
  uploadFileToCOSPost as uploadFileToCOS,
  uploadMetadataToCOSPost as uploadMetadataToCOS,
  type NFTMetadata,
} from "@/lib/cos-upload-post";

const SEPOLIA_CHAIN_ID = 11155111;
const CONTRACT_ADDRESS = "0xBD8d85D9Bdc8A07741E546bAD7547d2907180781";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nftName, setNftName] = useState("");
  const [nftDescription, setNftDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [mintAddress, setMintAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [txHash, setTxHash] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("请选择图片文件"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("图片大小不能超过 10MB"); return; }
    setSelectedImage(file);
    setError("");
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleMint = async () => {
    if (!isConnected || !address) { setError("请先连接钱包"); return; }
    if (chainId !== SEPOLIA_CHAIN_ID) { setError("请切换到 Sepolia 测试网"); return; }
    if (!nftName.trim()) { setError("请输入 NFT 名称"); return; }
    if (!nftDescription.trim()) { setError("请输入 NFT 描述"); return; }
    if (!selectedImage) { setError("请选择 NFT 图片"); return; }
    const targetAddress = mintAddress || address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) { setError("接收地址格式不正确"); return; }

    setLoading(true); setError(""); setSuccess(false); setTxHash(""); setTokenId("");

    try {
      setCurrentStep("上传图片...");
      const imageTokenData = await getCOSToken("image", selectedImage.name, selectedImage.size);
      if (!imageTokenData?.result) throw new Error("获取上传凭证失败");
      const imageUrl = await uploadFileToCOS(selectedImage, imageTokenData.result);

      setCurrentStep("生成 Metadata...");
      const metadata: NFTMetadata = {
        name: nftName, description: nftDescription, image: imageUrl,
        attributes: [
          { trait_type: "Creator", value: address || "" },
          { trait_type: "Created At", value: new Date().toISOString() },
        ],
      };
      const metadataUrl = await uploadMetadataToCOS(metadata);

      setCurrentStep("铸造中...");
      const mintResponse = await axios.post("/api/v1/metanode/mint", {
        chain_id: SEPOLIA_CHAIN_ID, to_address: targetAddress,
        token_uri: metadataUrl, name: nftName, description: nftDescription,
      });

      const responseData = mintResponse.data.data || mintResponse.data;
      const mintResult = responseData.result || responseData;
      const hash = mintResult.tx_hash || responseData.transaction_id || mintResult.transaction_id;
      const tid = mintResult.token_id || responseData.token_id;
      if (hash) setTxHash(hash);
      if (tid) setTokenId(tid.toString());

      if (mintResult.status === "confirmed" || responseData.message?.includes("successfully") || mintResponse.data.msg === "Successful") {
        setSuccess(true); setError(""); setCurrentStep("");
      } else if (mintResult.status === "pending") {
        setCurrentStep("等待确认...");
        setTimeout(() => { setSuccess(true); setError(""); setCurrentStep(""); }, 2000);
      } else {
        setError("铸造失败，请重试"); setCurrentStep("");
      }
    } catch (err: any) {
      console.error("铸造失败:", err);
      setError(err.message || "铸造失败，请重试"); setCurrentStep("");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNftName(""); setNftDescription(""); setSelectedImage(null);
    setImagePreview(""); setMintAddress(""); setTxHash(""); setTokenId("");
    setError(""); setSuccess(false); setCurrentStep("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addNFTToWallet = async () => {
    if (!window.ethereum || !tokenId) return;
    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: { type: "ERC721", options: { address: CONTRACT_ADDRESS, tokenId } },
      });
    } catch {
      try {
        await window.ethereum.request({
          method: "wallet_watchAsset",
          params: { type: "ERC20", options: { address: CONTRACT_ADDRESS, symbol: "MNODE", decimals: 0, image: imagePreview || "" } },
        });
      } catch {
        setError(`钱包不支持自动添加，请手动导入：\n合约: ${CONTRACT_ADDRESS}\nToken ID: ${tokenId}`);
      }
    }
  };

  // ── 未连接 / 网络错误 ──
  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-center">
          <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">连接钱包开始铸造</h3>
          <p className="text-sm text-muted-foreground">请先连接您的钱包</p>
        </div>
      </div>
    );
  }

  if (chainId !== SEPOLIA_CHAIN_ID) {
    return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="text-center">
          <div className="bg-yellow-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold mb-1">请切换网络</h3>
          <p className="text-sm text-muted-foreground">请切换到 Sepolia 测试网</p>
        </div>
      </div>
    );
  }

  // ── 铸造成功 ──
  if (success) {
    return (
      <div className="h-[calc(100vh-73px)] flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-card border border-border rounded-2xl p-8 text-center">
          <div className="bg-emerald-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">铸造成功！</h2>
          {tokenId && (
            <p className="text-sm text-muted-foreground mb-1">
              Token ID: <span className="font-mono font-semibold text-foreground">{tokenId}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mb-6 font-mono truncate">
            {CONTRACT_ADDRESS}
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button onClick={addNFTToWallet} variant="outline" size="sm" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />添加到钱包
            </Button>
            {txHash && (
              <Button onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, "_blank")} variant="outline" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />查看交易
              </Button>
            )}
            <Button onClick={() => (location.href = "/portfolio")} variant="outline" size="sm" className="text-xs">
              在资产查看
            </Button>
            {tokenId && (
              <Button onClick={() => window.open(`https://sepolia.etherscan.io/token/${CONTRACT_ADDRESS}?a=${tokenId}`, "_blank")} variant="outline" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />Etherscan
              </Button>
            )}
          </div>
          <Button onClick={resetForm} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />继续铸造
          </Button>
        </div>
      </div>
    );
  }

  // ── 铸造表单（双栏布局） ──
  return (
    <div className="h-[calc(100vh-73px)] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.2fr] min-h-0">
          {/* ── 左栏：图片上传 ── */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative bg-muted/30 flex items-center justify-center cursor-pointer group min-h-[320px] md:min-h-0"
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="预览" className="w-full h-full object-contain p-4" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">点击更换图片</span>
                </div>
              </>
            ) : (
              <div className="text-center p-6">
                <div className="bg-muted rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-center mb-1">
                  <Upload className="h-4 w-4 text-primary mr-1.5" />
                  <span className="text-sm font-medium">点击上传图片</span>
                </div>
                <p className="text-xs text-muted-foreground">JPG / PNG / GIF，最大 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* ── 右栏：表单 ── */}
          <div className="p-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">铸造 NFT</h1>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">名称</Label>
                  <Input
                    id="name"
                    placeholder="为你的 NFT 命名"
                    value={nftName}
                    onChange={(e) => setNftName(e.target.value)}
                    className="mt-1 bg-background border-border h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="desc" className="text-sm font-medium">描述</Label>
                  <textarea
                    id="desc"
                    placeholder="描述你的 NFT..."
                    value={nftDescription}
                    onChange={(e) => setNftDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="addr" className="text-sm font-medium">接收地址（可选）</Label>
                    <button
                      onClick={() => address && setMintAddress(address)}
                      className="text-xs text-primary hover:underline"
                    >
                      使用我的地址
                    </button>
                  </div>
                  <Input
                    id="addr"
                    placeholder={`默认: ${address?.slice(0, 6)}...${address?.slice(-4)}`}
                    value={mintAddress}
                    onChange={(e) => setMintAddress(e.target.value)}
                    className="mt-1 bg-background border-border h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 状态提示 */}
            <div className="space-y-2">
              {loading && currentStep && (
                <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {currentStep}
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-2">{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleMint} disabled={loading} className="flex-1 h-10 font-semibold">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />铸造中...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />开始铸造</>
                  )}
                </Button>
                {error && (
                  <Button onClick={resetForm} variant="outline" className="h-10">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                <span>Sepolia 测试网</span>
                <span>·</span>
                <span>免 Gas</span>
                <span>·</span>
                <span className="font-mono truncate">{CONTRACT_ADDRESS.slice(0, 10)}...{CONTRACT_ADDRESS.slice(-6)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
