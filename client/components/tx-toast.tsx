"use client";

import { toast } from "sonner";

const EXPLORER_BASE = "https://sepolia.voyager.online/tx/";

export function txToast(txHash: string) {
  const id = toast.loading("Transaction pending...", {
    description: txHash.slice(0, 10) + "...",
    action: {
      label: "View",
      onClick: () => window.open(EXPLORER_BASE + txHash, "_blank"),
    },
  });

  return {
    success: () => {
      toast.success("Transaction confirmed", {
        id,
        description: txHash.slice(0, 10) + "...",
        action: {
          label: "View",
          onClick: () => window.open(EXPLORER_BASE + txHash, "_blank"),
        },
      });
    },
    error: (msg?: string) => {
      toast.error(msg || "Transaction failed", {
        id,
        description: txHash.slice(0, 10) + "...",
        action: {
          label: "View",
          onClick: () => window.open(EXPLORER_BASE + txHash, "_blank"),
        },
      });
    },
  };
}

export function errorToast(msg: string) {
  toast.error("Error", { description: msg });
}
