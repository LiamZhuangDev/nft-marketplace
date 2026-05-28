"use client";
import { CollectionsTable } from "@/components/collections-table";
import collectionApi from "@/api/collections";
import { useEffect, useState } from "react";
import { useGlobalState } from "@/hooks/useGlobalState";
import { useAccount } from "wagmi";
import MarketHero from "./market-hero";

type CollectionsProps = {
  type: string;
};

export default function Collections({ type }: CollectionsProps) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { state, setState } = useGlobalState();
  const { address } = useAccount();

  useEffect(() => {
    if (address) {
      setState({ walletAddress: address as string });
    }
  }, [address]);

  async function fetchCollections() {
    setLoading(true);
     
    // if (type == "trending") {
      const res = await collectionApi.GetCollections({
        limit: 10,
        range: "1d",
      });
      // @ts-ignore
      setCollections(res?.result || []);
      setLoading(false); 
   
  }

  useEffect(() => {
    fetchCollections();
    // if (type != "trending") {
    //   fetchMyCollections();
    // }
  }, []);

  // async function fetchMyCollections() {
  //   setLoading(true);
     
  //   const res = await portfolioApi.GetPortfolio({
  //     filters: {
  //       user_addresses: [state.walletAddress],
  //     },
  //   });
  //   // @ts-ignore
  //   setCollections(res?.result?.collection_info || []);
  //   setLoading(false);
  // }

  return (
    <div className="pb-8">
      <MarketHero collections={collections} loading={loading} />
      <div className="px-6 pt-8 pb-2">
        <h2 className="text-2xl font-semibold text-white">Collections 排行数据</h2>
        <p className="text-sm text-gray-400 mt-1">跟踪地板价、成交量、持有者和供应变化</p>
      </div>
      <CollectionsTable collections={collections} loading={loading} />
    </div>
  );
}
