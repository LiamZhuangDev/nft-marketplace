'use client'

import '@rainbow-me/rainbowkit/styles.css';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { NavBar } from "@/components/nav-bar";
import { config } from '@/config/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TxMessageCenter } from "@/components/ui/tx-message-center";

const client = new QueryClient();

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (<WagmiProvider config={config}>
        <QueryClientProvider client={client}>
            <RainbowKitProvider>
                <NavBar />
                <div className="pt-[73px]">
                    {children}
                </div>
                <TxMessageCenter />
            </RainbowKitProvider>
        </QueryClientProvider>
    </WagmiProvider>)
}