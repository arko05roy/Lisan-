"use client";

import { useState, useEffect } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, CheckCircle2, Shield, ShieldCheck, Unlock, RefreshCw, Network } from "lucide-react";
import { getPoolNotes, getAmmNotes, addNote, markPoolNoteSpent, markNoteConfirmed, PoolNote, AmmNote } from "@/lib/storage";
import { generateSecret, computeCommitment, computeNullifierHash } from "@/lib/crypto";
import { txToast, errorToast } from "@/components/tx-toast";
import { buildTreeFromChain } from "@/lib/merkle";
import { ADDRESSES, TOKEN_TYPE_BTC } from "@/lib/addresses";
import { generatePoolTransferProof } from "@/lib/prover";
import { relayTransfer, getRelayTxStatus } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WithdrawFlow } from "@/components/privacy/withdraw-flow";
import { isCoordinatorAvailable, selectRelayer, coordinatorTransfer, calculateFee, getFeeBps } from "@/lib/coordinator-relay";
import { RpcProvider } from "starknet";

export default function TransferPage() {
  const { address, account } = useAccount();
  const { provider } = useProvider();
  const [activeTab, setActiveTab] = useState<"send" | "withdraw" | "receive">("send");

  // Transfer state
  const [notes, setNotes] = useState<PoolNote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [recipient, setRecipient] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [recipientSecrets, setRecipientSecrets] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"PREPARE" | "RELAY" | "DONE">("PREPARE");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Withdraw state
  const [withdrawNotes, setWithdrawNotes] = useState<(PoolNote | AmmNote)[]>([]);
  const [activeWithdrawNote, setActiveWithdrawNote] = useState<PoolNote | AmmNote | null>(null);
  const [isWithdrawFlowOpen, setIsWithdrawFlowOpen] = useState(false);

  // On-chain coordinator state
  const [useCoordinator, setUseCoordinator] = useState(false);
  const [coordinatorReady, setCoordinatorReady] = useState(false);
  const [feeBps, setFeeBps] = useState(10); // default 0.1%

  useEffect(() => {
    setNotes(getPoolNotes().filter((n) => !n.spent));
    refreshWithdrawNotes();

    // Check if on-chain coordinator is available
    if (provider) {
      isCoordinatorAvailable(provider as unknown as RpcProvider).then((available) => {
        setCoordinatorReady(available);
        if (available) {
          setUseCoordinator(true);
          getFeeBps(provider as unknown as RpcProvider).then((bps) => setFeeBps(bps)).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [provider]);

  const refreshWithdrawNotes = () => {
    const poolNotes = getPoolNotes().filter((n) => !n.spent);
    const ammNotes = getAmmNotes().filter((n) => !n.spent);
    const allNotes = [
      ...poolNotes.map(n => ({ ...n, _source: "pool" as const })),
      ...ammNotes.map(n => ({ ...n, _source: "amm" as const }))
    ].sort((a, b) => b.createdAt - a.createdAt);
    setWithdrawNotes(allNotes);
  };

  const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;
  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

  const getTokenLabel = (tokenAddress: string) => {
    if (tokenAddress === ADDRESSES.MOCK_BTC) return "BTC";
    if (tokenAddress === ADDRESSES.MOCK_STRK) return "STRK";
    if (tokenAddress === ADDRESSES.DEMO_TOKEN) return "DEMO";
    return tokenAddress.slice(0, 8) + "...";
  };

  async function handleTransfer() {
    const canSubmit = useCoordinator
      ? (!!account && !!selectedNote && !!transferAmount)
      : (!relayerDisabled && !!address && !!selectedNote && !!transferAmount);
    if (!canSubmit || !selectedNote) return;
    setLoading(true);
    setRecipientSecrets(null);
    setWizardStep("PREPARE");
    setIsWizardOpen(true);

    try {
      const transferAmountWei = BigInt(transferAmount) * 10n ** 18n;
      const oldAmountBig = BigInt(selectedNote.amount);

      // Calculate relayer fee if using coordinator
      const relayerFee = useCoordinator ? calculateFee(transferAmountWei, feeBps) : 0n;
      const changeAmount = oldAmountBig - transferAmountWei - relayerFee;

      if (changeAmount < 0n) {
        throw new Error("Transfer amount (+ fee) exceeds note balance");
      }

      setStatusMessage("Generating new secrets...");
      await new Promise(r => setTimeout(r, 100));

      // Generate new secrets for sender change note
      const newSecretSender = generateSecret();
      const newNullifierSecretSender = generateSecret();
      const newCommitmentSender = await computeCommitment(
        changeAmount.toString(),
        newSecretSender,
        newNullifierSecretSender,
      );

      // Generate new secrets for recipient note
      const newSecretRecipient = generateSecret();
      const newNullifierSecretRecipient = generateSecret();
      const newCommitmentRecipient = await computeCommitment(
        transferAmountWei.toString(),
        newSecretRecipient,
        newNullifierSecretRecipient,
      );

      setStatusMessage("Verifying deposit confirmation...");
      const normalizedCommitment = "0x" + BigInt(selectedNote.commitment).toString(16);
      let treeResult = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
      let leafIndex = treeResult.commitmentToLeafIndex.get(normalizedCommitment);

      if (leafIndex === undefined) {
        setStatusMessage("Waiting for deposit confirmation...");
        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          setStatusMessage(`Waiting for confirmation... (${(attempt + 1) * 2}s)`);
          treeResult = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
          leafIndex = treeResult.commitmentToLeafIndex.get(normalizedCommitment);
          if (leafIndex !== undefined) {
            markNoteConfirmed(selectedNote.commitment);
            break;
          }
        }
        if (leafIndex === undefined) {
          throw new Error("Deposit not found on-chain. Try depositing fresh funds.");
        }
      }

      setStatusMessage("Generating Zero-Knowledge Proof...");
      const path = await treeResult.tree.getPath(leafIndex);
      const root = treeResult.tree.getRoot().toString();
      const nullifierHash = await computeNullifierHash(selectedNote.nullifierSecret);

      // Debug info
      console.log("[Transfer Debug]", {
        leafIndex,
        treeSize: treeResult.tree.getNextIndex(),
        root: root,
        commitment: normalizedCommitment,
      });

      const { fullProofWithHints } = await generatePoolTransferProof(
        selectedNote,
        path,
        root,
        nullifierHash,
        newCommitmentSender,
        newCommitmentRecipient,
        changeAmount.toString(),
        transferAmountWei.toString(),
        newSecretSender,
        newNullifierSecretSender,
        newSecretRecipient,
        newNullifierSecretRecipient,
      );

      setWizardStep("RELAY");

      let transactionHash: string;
      let usedCoordinator = false;

      if (useCoordinator && account) {
        // On-chain coordinator path (with fallback to default relayer)
        try {
          setStatusMessage("Selecting relayer from network...");
          const relayerId = await selectRelayer(account);

          setStatusMessage(`Submitting via Relayer #${relayerId}... (fee: ${(feeBps / 100).toFixed(1)}%)`);
          const result = await coordinatorTransfer(account, {
            fullProofWithHints,
            root,
            nullifierHash,
            newCommitmentSender,
            newCommitmentRecipient,
            relayerId,
            feeAmount: relayerFee,
          });
          transactionHash = result.transactionHash;
          usedCoordinator = true;
        } catch (coordError) {
          console.warn("[Coordinator fallback] On-chain coordinator failed, falling back to default relayer:", coordError);
          setStatusMessage("Coordinator unavailable, falling back to default relayer...");
          const result = await relayTransfer("", {
            fullProofWithHints,
            root,
            nullifierHash,
            newCommitmentSender,
            newCommitmentRecipient,
          });
          transactionHash = result.transactionHash;
        }
      } else {
        // Legacy off-chain relayer path
        setStatusMessage("Submitting to Relayer...");
        const result = await relayTransfer(relayerUrl, {
          fullProofWithHints,
          root,
          nullifierHash,
          newCommitmentSender,
          newCommitmentRecipient,
        });
        transactionHash = result.transactionHash;
      }

      setTxHash(transactionHash);
      setStatusMessage("Waiting for confirmation...");

      if (usedCoordinator) {
        // For on-chain coordinator, just wait for tx receipt
        await (provider as unknown as RpcProvider).waitForTransaction(transactionHash);
      } else {
        // Legacy polling for off-chain relayer
        const fallbackRelayerUrl = relayerUrl || "";
        const maxAttempts = 60;
        let finalStatus = "PENDING";
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const res = await getRelayTxStatus(fallbackRelayerUrl, transactionHash);
            finalStatus = res.status;
            if (finalStatus === "ACCEPTED_ON_L2" || finalStatus === "REJECTED") break;
          } catch (e) { }
        }
        if (finalStatus !== "ACCEPTED_ON_L2") throw new Error("Transaction rejected");
      }

      txToast(transactionHash).success();
      markPoolNoteSpent(selectedNote.commitment);

      if (changeAmount > 0n) {
        addNote({
          type: "pool",
          commitment: newCommitmentSender,
          amount: changeAmount.toString(),
          secret: newSecretSender,
          nullifierSecret: newNullifierSecretSender,
          spent: false,
          createdAt: Date.now(),
          txHash: transactionHash,
          confirmed: false,
          tokenAddress: selectedNote.tokenAddress,
        });
      }

      addNote({
        type: "pool",
        commitment: newCommitmentRecipient,
        amount: transferAmountWei.toString(),
        secret: newSecretRecipient,
        nullifierSecret: newNullifierSecretRecipient,
        spent: false,
        createdAt: Date.now(),
        txHash: transactionHash,
        confirmed: false,
        tokenAddress: selectedNote.tokenAddress,
      });

      setRecipientSecrets(
        JSON.stringify({
          commitment: newCommitmentRecipient,
          amount: transferAmountWei.toString(),
          secret: newSecretRecipient,
          nullifierSecret: newNullifierSecretRecipient,
        }, null, 2),
      );

      setWizardStep("DONE");
      setNotes(getPoolNotes().filter((n) => !n.spent));
      setSelectedIdx(null);
      setRecipient("");
      setTransferAmount("");
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Transfer failed");
      setIsWizardOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[700px] mx-auto pt-8">
      {/* Main Card */}
      <div className="bg-[#0D1117] rounded-3xl border border-white/[0.06] shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center justify-center gap-12 px-8 pt-8 pb-6 border-b border-white/[0.04]">
          <button
            onClick={() => setActiveTab("send")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "send" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
            }`}
          >
            Send
            {activeTab === "send" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("withdraw")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "withdraw" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
            }`}
          >
            Withdraw
            {activeTab === "withdraw" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("receive")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "receive" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
            }`}
          >
            Receive
            {activeTab === "receive" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF] rounded-full" />
            )}
          </button>
        </div>

        {/* Form Content */}
        <div className="p-8 space-y-6">
          {activeTab === "send" && (
            <>
              {/* Relayer Mode Toggle */}
              {coordinatorReady && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#8B8CFF]/20 bg-[#8B8CFF]/5">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-[#8B8CFF]" />
                    <span className="text-sm font-medium text-white/80">On-Chain Relayer Network</span>
                    <span className="text-xs text-white/40">(fee: {(feeBps / 100).toFixed(1)}%)</span>
                  </div>
                  <button
                    onClick={() => setUseCoordinator(!useCoordinator)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      useCoordinator ? "bg-[#8B8CFF]" : "bg-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        useCoordinator ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              )}

              {/* Relayer Configuration (only for legacy mode) */}
              {!useCoordinator && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-white/80">Relayer</Label>
                  <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
                </div>
              )}

              {/* Select Note */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-white">Send from (Shielded Note)</Label>
                {notes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center">
                    <p className="text-white/40">No shielded notes available</p>
                    <Button variant="link" className="text-[#8B8CFF] mt-2" onClick={() => window.location.href = '/deposit'}>
                      Create a note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notes.map((note, i) => {
                      const isSelected = selectedIdx === i;
                      const noteAmount = (BigInt(note.amount) / 10n ** 18n).toString();
                      return (
                        <div
                          key={note.commitment}
                          onClick={() => setSelectedIdx(i)}
                          className={cn(
                            "cursor-pointer rounded-xl border p-4 transition-all",
                            isSelected
                              ? "border-[#8B8CFF] bg-[#8B8CFF]/10 shadow-lg shadow-[#8B8CFF]/20"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8B8CFF]/10">
                                <Shield className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{getTokenLabel(note.tokenAddress)}</div>
                                <div className="text-xs text-white/40 font-mono">{note.commitment.slice(0, 12)}...</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-white">{noteAmount}</div>
                              <div className="text-xs text-white/40">{new Date(note.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div className={cn("space-y-3", !selectedNote && "opacity-50 pointer-events-none")}>
                <Label className="text-base font-bold text-white">Send to (Optional)</Label>
                <Input
                  placeholder="Recipient address or name (for reference)"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                />
                <p className="text-xs text-white/40">
                  Note: The recipient will receive secrets to claim the funds, not a direct transfer to their address.
                </p>
              </div>

              {/* Amount */}
              <div className={cn("space-y-3", !selectedNote && "opacity-50 pointer-events-none")}>
                <Label className="text-base font-bold text-white">Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                />
                {selectedNote && (
                  <p className="text-xs text-white/40">
                    Available: {(BigInt(selectedNote.amount) / 10n ** 18n).toString()} {getTokenLabel(selectedNote.tokenAddress)}
                  </p>
                )}
                {useCoordinator && transferAmount && selectedNote && (
                  <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs space-y-1">
                    <div className="flex justify-between text-white/60">
                      <span>Transfer amount</span>
                      <span>{transferAmount} {getTokenLabel(selectedNote.tokenAddress)}</span>
                    </div>
                    <div className="flex justify-between text-[#8B8CFF]">
                      <span>Relayer fee ({(feeBps / 100).toFixed(1)}%)</span>
                      <span>{(Number(transferAmount) * feeBps / 10000).toFixed(4)} {getTokenLabel(selectedNote.tokenAddress)}</span>
                    </div>
                    <div className="flex justify-between text-white/60 border-t border-white/[0.06] pt-1">
                      <span>Your change</span>
                      <span>
                        {(Number(BigInt(selectedNote.amount)) / 1e18 - Number(transferAmount) - Number(transferAmount) * feeBps / 10000).toFixed(4)} {getTokenLabel(selectedNote.tokenAddress)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Send Button */}
              <div className="pt-4">
                <Button
                  disabled={loading || !transferAmount || selectedIdx === null || (!useCoordinator && relayerDisabled)}
                  onClick={handleTransfer}
                  className="w-full h-14 bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white rounded-xl text-base font-bold shadow-lg shadow-[#8B8CFF]/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                >
                  {loading ? "Transferring..." : useCoordinator ? "Transfer via Relayer Network" : "Transfer Privately"}
                </Button>
              </div>
            </>
          )}

          {activeTab === "withdraw" && (
            <>
              {/* Relayer Mode Toggle for Withdraw */}
              {coordinatorReady && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#8B8CFF]/20 bg-[#8B8CFF]/5">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-[#8B8CFF]" />
                    <span className="text-sm font-medium text-white/80">On-Chain Relayer Network</span>
                    <span className="text-xs text-white/40">(fee: {(feeBps / 100).toFixed(1)}%)</span>
                  </div>
                  <button
                    onClick={() => setUseCoordinator(!useCoordinator)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      useCoordinator ? "bg-[#8B8CFF]" : "bg-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        useCoordinator ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              )}

              {/* Relayer Configuration (legacy mode) */}
              {!useCoordinator && (
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-white/80">Relayer</Label>
                  <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
                </div>
              )}

              {/* Withdraw Notes List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold text-white">Your Shielded Notes</Label>
                  <button
                    onClick={refreshWithdrawNotes}
                    className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 text-white/60" />
                  </button>
                </div>
                {withdrawNotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center">
                    <Unlock className="h-12 w-12 mx-auto mb-3 text-white/20" />
                    <p className="text-white/40">No shielded notes available</p>
                    <Button variant="link" className="text-[#8B8CFF] mt-2" onClick={() => window.location.href = '/deposit'}>
                      Create a note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {withdrawNotes.map((note) => {
                      const isAmm = "_source" in note && note._source === "amm";
                      const tokenLabel = isAmm
                        ? ((note as AmmNote).tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK")
                        : getTokenLabel((note as PoolNote).tokenAddress);
                      const noteAmount = (BigInt(note.amount) / 10n ** 18n).toString();

                      return (
                        <div
                          key={note.commitment}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] p-4 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8B8CFF]/10">
                                <Shield className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{tokenLabel}</div>
                                <div className="text-xs text-white/40 font-mono">{note.commitment.slice(0, 12)}...</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-lg font-bold text-white">{noteAmount}</div>
                                <div className="text-xs text-white/40">{new Date(note.createdAt).toLocaleDateString()}</div>
                              </div>
                              <Button
                                size="sm"
                                disabled={!useCoordinator && !selectedRelayer}
                                onClick={() => {
                                  setActiveWithdrawNote(note);
                                  setIsWithdrawFlowOpen(true);
                                }}
                                className="bg-[#8B8CFF] hover:bg-[#7B7CFF]"
                              >
                                Withdraw
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "receive" && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-32 h-32 bg-white/[0.04] rounded-2xl mb-4 border border-white/[0.08]">
                <div className="text-4xl">📥</div>
              </div>
              <p className="text-base text-white/60 mb-4">Your Address</p>
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 font-mono text-sm text-white/80 break-all relative group">
                {address || "Not connected"}
                {address && (
                  <button
                    onClick={() => navigator.clipboard.writeText(address)}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Wizard Dialog */}
      <Dialog open={isWizardOpen} onOpenChange={(v) => { if (!loading) setIsWizardOpen(v); }}>
        <DialogContent className="sm:max-w-md bg-[#0D1117] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Shielded Transfer</DialogTitle>
            <DialogDescription className="text-white/60">
              {wizardStep === "DONE" ? "Transfer Completed Successfully" : "Processing Private Transaction"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {wizardStep !== "DONE" ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-[#8B8CFF]" />
                <p className="text-sm font-medium text-white">{statusMessage}</p>
                {txHash && <p className="text-xs font-mono text-white/40 bg-white/[0.04] px-2 py-1 rounded">{txHash.slice(0, 16)}...</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-2 text-center text-[#22C55E] mb-4">
                  <CheckCircle2 className="h-12 w-12" />
                  <span className="font-bold">Transfer Complete!</span>
                </div>

                <div className="rounded-lg border border-[#8B8CFF]/20 bg-[#8B8CFF]/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[#8B8CFF] font-medium">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Recipient Secrets</span>
                  </div>
                  <p className="text-xs text-white/60">
                    Share these secrets with the recipient to claim the funds.
                  </p>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded bg-[#08090D] p-3 text-[10px] border border-white/[0.08] max-h-[150px] custom-scrollbar text-white/80">
                      {recipientSecrets}
                    </pre>
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute top-2 right-2 h-6 w-6 bg-white/[0.04] border-white/[0.08]"
                      onClick={() => navigator.clipboard.writeText(recipientSecrets || "")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {wizardStep === "DONE" && (
              <Button onClick={() => setIsWizardOpen(false)} className="w-full bg-[#8B8CFF] hover:bg-[#7B7CFF]">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Flow Dialog */}
      {activeWithdrawNote && (
        <WithdrawFlow
          note={activeWithdrawNote}
          isOpen={isWithdrawFlowOpen}
          onOpenChange={setIsWithdrawFlowOpen}
          relayer={selectedRelayer}
          useCoordinator={useCoordinator}
          feeBps={feeBps}
          onWithdrawComplete={() => {
            refreshWithdrawNotes();
            setNotes(getPoolNotes().filter((n) => !n.spent));
          }}
        />
      )}
    </div>
  );
}

