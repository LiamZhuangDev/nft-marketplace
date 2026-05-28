export const TX_MESSAGE_EVENT = "app:tx-message";

export type TxMessageType = "pending" | "success" | "error";

export interface TxMessageDetail {
  type: TxMessageType;
  title: string;
  description?: string;
  txHash?: string;
  chainId?: number | string;
  durationMs?: number;
}

