import { useCallback, useEffect, useState } from "react";
import activityApi from "@/api/activity";
import portfolioApi from "@/api/portfolio";

type UsePortfolioDataParams = {
  owner?: string;
  chainId?: number;
};

export function usePortfolioData({ owner, chainId }: UsePortfolioDataParams) {
  const [myListOrders, setMyListOrders] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [myMatchedOrders, setMyMatchedOrders] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);

  const [loadingListOrders, setLoadingListOrders] = useState(false);
  const [loadingBids, setLoadingBids] = useState(false);
  const [loadingMatchedOrders, setLoadingMatchedOrders] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadMyListOrders = useCallback(async () => {
    if (!owner || !chainId) return;
    setLoadingListOrders(true);
    try {
      const params = {
        filter_ids: [chainId],
        user_addresses: [owner],
        event_types: ["list"],
        page: 1,
        page_size: 100,
      };
      const res: any = await activityApi.GetActivity(params);
      setMyListOrders(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      console.error("获取我的挂单失败:", error);
      setMyListOrders([]);
    } finally {
      setLoadingListOrders(false);
    }
  }, [owner, chainId]);

  const loadMyBids = useCallback(async () => {
    if (!owner || !chainId) return;
    setLoadingBids(true);
    try {
      const res: any = await portfolioApi.GetPortfolioBids({
        filters: {
          chain_id: [chainId],
          collection_addresses: [],
          user_addresses: [owner],
          page: 1,
          page_size: 100,
        },
      });
      setMyBids(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      console.error("获取我的买单失败:", error);
      setMyBids([]);
    } finally {
      setLoadingBids(false);
    }
  }, [owner, chainId]);

  const loadMyMatchedOrders = useCallback(async () => {
    if (!owner || !chainId) return;
    setLoadingMatchedOrders(true);
    try {
      const res: any = await activityApi.GetActivity({
        filter_ids: [chainId],
        user_addresses: [owner],
        event_types: ["sale"],
        page: 1,
        page_size: 100,
        collection_addresses: [],
      });
      setMyMatchedOrders(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      console.error("获取我的成交记录失败:", error);
      setMyMatchedOrders([]);
    } finally {
      setLoadingMatchedOrders(false);
    }
  }, [owner, chainId]);

  const loadMyItems = useCallback(async () => {
    if (!owner || !chainId) return;
    setLoadingItems(true);
    try {
      const res: any = await portfolioApi.GetPortfolioItems({
        filters: {
          chain_id: [chainId],
          collection_addresses: [],
          user_addresses: [owner],
          page: 1,
          page_size: 100,
        },
      });
      setMyItems(Array.isArray(res?.result) ? res.result : []);
    } catch (error) {
      console.error("获取我的库存失败:", error);
      setMyItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [owner, chainId]);

  useEffect(() => {
    if (!owner || !chainId) {
      setMyListOrders([]);
      setMyBids([]);
      setMyMatchedOrders([]);
      setMyItems([]);
      return;
    }
    void Promise.all([
      loadMyListOrders(),
      loadMyBids(),
      loadMyMatchedOrders(),
      loadMyItems(),
    ]);
  }, [owner, chainId, loadMyListOrders, loadMyBids, loadMyMatchedOrders, loadMyItems]);

  return {
    myListOrders,
    myBids,
    myMatchedOrders,
    myItems,
    loadingListOrders,
    loadingBids,
    loadingMatchedOrders,
    loadingItems,
    refreshItems: loadMyItems,
  };
}

