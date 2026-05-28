"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "connected" | "connecting" | "disconnected";

const WS_URL = "wss://sepolia.gateway.tenderly.co";
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const PING_INTERVAL_MS = 25000;

/**
 * 维护一条到 Sepolia 节点的 WebSocket 长连接，
 * 对外暴露连接状态 + 最新区块号。
 */
export function useChainWebSocket() {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [latestBlock, setLatestBlock] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmounted = useRef(false);
  const connectRef = useRef<() => void>(null);

  const cleanup = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (unmounted.current) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** retryCount.current,
      RECONNECT_MAX_MS
    );
    retryCount.current += 1;
    retryTimer.current = setTimeout(() => connectRef.current?.(), delay);
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current) return;
    cleanup();
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) return;
      retryCount.current = 0;
      setStatus("connected");

      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_subscribe",
          params: ["newHeads"],
        })
      );

      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 9999,
              method: "net_version",
              params: [],
            })
          );
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.params?.result?.number) {
          setLatestBlock(parseInt(data.params.result.number, 16));
        }
      } catch {}
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      if (pingTimer.current) clearInterval(pingTimer.current);
      setStatus("disconnected");
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose 会紧跟触发
    };
  }, [cleanup, scheduleReconnect]);

  // 用 ref 打破 scheduleReconnect -> connect 的循环
  connectRef.current = connect;

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      cleanup();
    };
  }, [connect, cleanup]);

  return { status, latestBlock };
}
