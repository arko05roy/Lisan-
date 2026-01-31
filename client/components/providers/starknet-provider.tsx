"use client";

import { ReactNode } from "react";
import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, argent, braavos } from "@starknet-react/core";

const chains = [sepolia];
const connectors = [argent(), braavos()];

const rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL;

const provider = rpcUrl
  ? jsonRpcProvider({ rpc: () => ({ nodeUrl: rpcUrl }) })
  : jsonRpcProvider({ rpc: () => ({ nodeUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH" }) });

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={provider}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
