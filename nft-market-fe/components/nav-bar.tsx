"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Search, Globe, Sun, Moon, Bell, Menu, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ACCESS_TOKEN_KEY } from "@/constants";
import WalletConnect from "./wallet";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import userApi from "@/api/user";
import { useAccount, useChainId } from "wagmi";
import { useChainWebSocket, type WsStatus } from "@/hooks/useChainWebSocket";

function WsIndicator({ status }: { status: WsStatus }) {
  const colorMap: Record<WsStatus, { dot: string; ring: string; label: string }> = {
    connected:    { dot: "bg-emerald-400", ring: "bg-emerald-400/30", label: "已连接" },
    connecting:   { dot: "bg-yellow-400",  ring: "bg-yellow-400/30",  label: "连接中" },
    disconnected: { dot: "bg-yellow-400",  ring: "bg-yellow-400/30",  label: "已断开" },
  };
  const c = colorMap[status];

  return (
    <div className="flex items-center gap-1.5 select-none" title={`WebSocket: ${status}`}>
      <span className="relative flex h-2.5 w-2.5">
        {status === "connected" && (
          <span className={`absolute inset-0 rounded-full ${c.ring} animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${c.dot}`} />
      </span>
      <span className="text-xs font-medium text-foreground/80">{c.label}</span>
    </div>
  );
}

export function NavBar() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const chainId = useChainId();
  const { status: wsStatus } = useChainWebSocket();

  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function getSigStatus() {
    const res = await userApi.GetSigStatus(address as string);
    return res;
  }

  async function getLoginMessage() {
    const res = await userApi.GetLoginMessage(address as string);
    return res;
  }

  async function handleWalletLogin() {
    const sigStatus = await getSigStatus();
    if ((sigStatus as any).is_signed) {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        return;
      }
    }
    const res = await getLoginMessage();

    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [(res as any).nonce, address as string],
    });
    const loginRes = await userApi.Login({
      chain_id: chainId,
      message: (res as any).message,
      signature: signature as string,
      address: address as string,
    });

    const { result } = loginRes as any;
    const { token } = result as any;
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }

  useEffect(() => {
    if (address && isConnected) {
      handleWalletLogin();
    }
  }, [address, isConnected]);

  const handleNavigation = (path: string) => {
    router.push(`/${path}`);
  };

  const NAV_ITEMS = [
    { path: "collections", label: "市场" },
    { path: "portfolio",   label: "资产" },
    { path: "activity",    label: "动态" },
    { path: "airdrop",     label: "空投" },
    { path: "mint",        label: "铸造" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 px-6 py-3 bg-background backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="text-primary font-bold text-2xl font-poppins">
            <img src="/logo.png" alt="MetaNode" width={60} height={60} />
          </div>

          {/* WS 状态指示灯 */}
          <WsIndicator status={wsStatus} />

          {/* 桌面端导航菜单 */}
          <div className="hidden md:flex space-x-5 text-sm">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`cursor-pointer transition-colors ${
                  pathname?.includes(item.path)
                    ? "text-primary glow-text"
                    : "text-foreground hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* 桌面端右侧工具栏 */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="relative w-64">
            <Input
              type="search"
              placeholder="搜索合集、钱包或 ENS"
              className="bg-gray-900 border-gray-700 pl-10"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground" />
          </div>
          <Globe className="h-5 w-5 text-foreground" />
          {!mounted ? null : (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-foreground hover:text-white"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          )}
          <Bell className="h-5 w-5 text-foreground" />
          <ConnectButton />
        </div>

        {/* 移动端菜单按钮 */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* 移动端菜单 */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[73px] bg-background z-40">
          <div className="flex flex-col p-4 space-y-4">
            <div className="flex flex-col space-y-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.path}
                  onClick={() => {
                    handleNavigation(item.path);
                    setIsMenuOpen(false);
                  }}
                  className={`cursor-pointer ${
                    pathname?.includes(item.path)
                      ? "text-primary glow-text"
                      : "text-foreground hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="space-y-4">
              <div className="relative w-full">
                <Input
                  type="search"
                  placeholder="搜索合集、钱包或 ENS"
                  className="bg-gray-900 border-gray-700 pl-10 w-full"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground" />
              </div>

              <div className="flex items-center justify-between">
                <WsIndicator status={wsStatus} />
                <Globe className="h-5 w-5 text-foreground" />
                {!mounted ? null : (
                  <button
                    onClick={() =>
                      setTheme(theme === "dark" ? "light" : "dark")
                    }
                    className="text-foreground hover:text-white"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                )}
                <Bell className="h-5 w-5 text-foreground" />
                <WalletConnect />
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
