"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getExplorerBaseUrl } from "@/lib/utils";
import { TX_MESSAGE_EVENT, type TxMessageDetail, type TxMessageType } from "@/lib/tx-message";

interface TxMessageItem extends TxMessageDetail {
  id: string;
  durationMs: number;
}

const TYPE_STYLES: Record<TxMessageType, string> = {
  pending: "border-blue-500/40 bg-blue-500/10 text-blue-100",
  success: "border-green-500/40 bg-green-500/10 text-green-100",
  error: "border-red-500/40 bg-red-500/10 text-red-100",
};

const PROGRESS_STYLES: Record<TxMessageType, string> = {
  pending: "bg-blue-400",
  success: "bg-green-400",
  error: "bg-red-400",
};

export function TxMessageCenter() {
  const [messages, setMessages] = useState<TxMessageItem[]>([]);

  useEffect(() => {
    const onMessage = (event: Event) => {
      const customEvent = event as CustomEvent<TxMessageDetail>;
      const detail = customEvent.detail;
      if (!detail?.title) return;

      const item: TxMessageItem = {
        ...detail,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        durationMs: detail.durationMs ?? 6000,
      };

      setMessages((prev) => [...prev, item]);
      window.setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== item.id));
      }, item.durationMs);
    };

    window.addEventListener(TX_MESSAGE_EVENT, onMessage as EventListener);
    return () => {
      window.removeEventListener(TX_MESSAGE_EVENT, onMessage as EventListener);
    };
  }, []);

  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const rendered = useMemo(
    () =>
      messages.map((msg) => {
        const explorerBase = getExplorerBaseUrl(msg.chainId ?? 11155111);
        const txUrl = msg.txHash ? `${explorerBase}/tx/${msg.txHash}` : "";

        return (
          <div
            key={msg.id}
            className={`w-96 max-w-[calc(100vw-2rem)] rounded-xl border p-3 shadow-lg backdrop-blur ${TYPE_STYLES[msg.type]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{msg.title}</div>
                {msg.description && (
                  <div className="mt-1 text-xs text-white/80 break-words">{msg.description}</div>
                )}
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-xs underline underline-offset-2 text-white"
                  >
                    到区块链浏览器查看
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeMessage(msg.id)}
                className="text-white/70 hover:text-white"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 h-1 w-full rounded bg-white/20 overflow-hidden">
              <div
                className={`h-full ${PROGRESS_STYLES[msg.type]} tx-progress-bar`}
                style={{ animationDuration: `${msg.durationMs}ms` }}
              />
            </div>
          </div>
        );
      }),
    [messages],
  );

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-3">
      {rendered}
      <style jsx>{`
        .tx-progress-bar {
          transform-origin: left;
          animation-name: shrink;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        @keyframes shrink {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
}

