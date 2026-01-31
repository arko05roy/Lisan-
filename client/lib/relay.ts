export interface PrepareWithdrawParams {
  contract: "pool" | "amm";
  fullProofWithHints: string[];
  root: string;
  nullifierHash: string;
  withdrawAmount: string;
  tokenType?: string;
  tokenAddress?: string;
}

export interface TransferParams {
  fullProofWithHints: string[];
  root: string;
  nullifierHash: string;
  newCommitmentSender: string;
  newCommitmentRecipient: string;
}

export interface SwapParams {
  fullProofWithHints: string[];
  root: string;
  nullifierHash: string;
  tokenTypeIn: string;
  amountIn: string;
  tokenTypeOut: string;
  newCommitment: string;
  amountOut: string;
}

export interface ClaimBetParams {
  marketId: string;
  fullProofWithHints: string[];
  betCommitment: string;
  nullifierHash: string;
  recipient: string;
}

export interface PrivateExecuteParams {
  fullProofWithHints: string[];
  root: string;
  nullifierHash: string;
  tokenAddress: string;
  amount: string;
  targetContract: string;
  callData: string[];
  changeCommitment: string;
  changeAmount: string;
}

export interface ClaimWithdrawalParams {
  contract: "pool" | "amm";
  nullifierHash: string;
  recipient: string;
}

export interface RelayResponse {
  transactionHash: string;
}

export interface RelayStatusResponse {
  status: "PENDING" | "ACCEPTED_ON_L2" | "REJECTED";
}

async function relayFetch<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Relay request failed (${res.status})`);
  }
  return data as T;
}

export function relayPrepareWithdraw(relayerUrl: string, params: PrepareWithdrawParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/prepare-withdraw`, params);
}

export function relayTransfer(relayerUrl: string, params: TransferParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/transfer`, params);
}

export function relaySwap(relayerUrl: string, params: SwapParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/swap`, params);
}

export function relayClaimBet(relayerUrl: string, params: ClaimBetParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/claim-bet`, params);
}

export function relayPrivateExecute(relayerUrl: string, params: PrivateExecuteParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/private-execute`, params);
}

export function relayClaimWithdrawal(relayerUrl: string, params: ClaimWithdrawalParams) {
  return relayFetch<RelayResponse>(`${relayerUrl}/api/relay/claim-withdrawal`, params);
}

export function getRelayTxStatus(relayerUrl: string, txHash: string) {
  return relayFetch<RelayStatusResponse>(`${relayerUrl}/api/relay/status/${txHash}`);
}
