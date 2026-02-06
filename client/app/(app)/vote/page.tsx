"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { ADDRESSES } from "@/lib/addresses";
import { PRIVATE_VOTING_ABI } from "@/lib/abis";
import { generateSecret, computeVoteCommitment, computeNullifierHash } from "@/lib/crypto";
import { addNote, getVoteNotes, VoteNote, addProposal, getProposal } from "@/lib/storage";
import { buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { hash } from "starknet";
import { Vote, Plus, ShieldCheck, Eye, CheckCircle2, Clock, Users, ChevronDown, ChevronUp } from "lucide-react";

type ViewMode = "proposals" | "create" | "tally";

interface ProposalData {
  id: number;
  descriptionHash: string;
  description?: string;
  optionLabels?: string[];
  numOptions: string;
  endTime: bigint;
  voteCount: bigint;
  isTallied: boolean;
  winningOption?: string;
}

export default function VotePage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  const [view, setView] = useState<ViewMode>("proposals");
  const [description, setDescription] = useState("");
  const [numOptions, setNumOptions] = useState("2");
  const [endMinutes, setEndMinutes] = useState("60");
  const [optionLabels, setOptionLabels] = useState<string[]>(["Yes", "No"]);
  const [tallyProposalId, setTallyProposalId] = useState("");
  const [voteNotes, setVoteNotes] = useState<VoteNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [expandedProposal, setExpandedProposal] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});

  // Update option labels when number of options changes
  useEffect(() => {
    const num = parseInt(numOptions) || 2;
    const currentLabels = [...optionLabels];
    if (currentLabels.length < num) {
      // Add more labels
      for (let i = currentLabels.length; i < num; i++) {
        currentLabels.push(`Option ${i}`);
      }
    } else if (currentLabels.length > num) {
      // Remove extra labels
      currentLabels.length = num;
    }
    setOptionLabels(currentLabels);
  }, [numOptions]);

  const { data: proposalCount } = useReadContract({
    address: ADDRESSES.PRIVATE_VOTING as `0x${string}`,
    abi: PRIVATE_VOTING_ABI,
    functionName: "get_proposal_count",
    args: [],
  });

  useEffect(() => {
    setVoteNotes(getVoteNotes());
  }, []);

  // Fetch all proposals
  useEffect(() => {
    async function fetchProposals() {
      if (!proposalCount) return;

      setLoadingProposals(true);
      const count = Number(proposalCount);
      const proposalsData: ProposalData[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const descResponse = await fetch(
            `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: [
                  {
                    contract_address: ADDRESSES.PRIVATE_VOTING,
                    entry_point_selector: hash.getSelectorFromName("get_proposal_description"),
                    calldata: [i.toString()],
                  },
                  "latest",
                ],
                id: 1,
              }),
            }
          );
          const descData = await descResponse.json();

          const optionsResponse = await fetch(
            `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: [
                  {
                    contract_address: ADDRESSES.PRIVATE_VOTING,
                    entry_point_selector: hash.getSelectorFromName("get_proposal_num_options"),
                    calldata: [i.toString()],
                  },
                  "latest",
                ],
                id: 2,
              }),
            }
          );
          const optionsData = await optionsResponse.json();

          const endTimeResponse = await fetch(
            `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: [
                  {
                    contract_address: ADDRESSES.PRIVATE_VOTING,
                    entry_point_selector: hash.getSelectorFromName("get_proposal_end_time"),
                    calldata: [i.toString()],
                  },
                  "latest",
                ],
                id: 3,
              }),
            }
          );
          const endTimeData = await endTimeResponse.json();

          const voteCountResponse = await fetch(
            `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: [
                  {
                    contract_address: ADDRESSES.PRIVATE_VOTING,
                    entry_point_selector: hash.getSelectorFromName("get_proposal_vote_count"),
                    calldata: [i.toString()],
                  },
                  "latest",
                ],
                id: 4,
              }),
            }
          );
          const voteCountData = await voteCountResponse.json();

          const talliedResponse = await fetch(
            `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "starknet_call",
                params: [
                  {
                    contract_address: ADDRESSES.PRIVATE_VOTING,
                    entry_point_selector: hash.getSelectorFromName("is_proposal_tallied"),
                    calldata: [i.toString()],
                  },
                  "latest",
                ],
                id: 5,
              }),
            }
          );
          const talliedData = await talliedResponse.json();

          let winningOption;
          if (talliedData.result?.[0] !== "0x0") {
            const winningResponse = await fetch(
              `https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/1SvsFZSzJc3wVfaC1Hh2nXC0jo0J5wdH`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "starknet_call",
                  params: [
                    {
                      contract_address: ADDRESSES.PRIVATE_VOTING,
                      entry_point_selector: hash.getSelectorFromName("get_winning_option"),
                      calldata: [i.toString()],
                    },
                    "latest",
                  ],
                  id: 6,
                }),
              }
            );
            const winningData = await winningResponse.json();
            winningOption = winningData.result?.[0];
          }

          const metadata = getProposal(i);

          proposalsData.push({
            id: i,
            descriptionHash: descData.result?.[0] || "0x0",
            description: metadata?.description,
            optionLabels: metadata?.optionLabels,
            numOptions: optionsData.result?.[0] || "0",
            endTime: BigInt(endTimeData.result?.[0] || "0"),
            voteCount: BigInt(voteCountData.result?.[0] || "0"),
            isTallied: talliedData.result?.[0] !== "0x0",
            winningOption,
          });
        } catch (error) {
          console.error(`Error fetching proposal ${i}:`, error);
        }
      }

      setProposals(proposalsData.reverse());
      setLoadingProposals(false);
    }

    fetchProposals();
  }, [proposalCount]);

  async function createProposal() {
    if (!address || !description || !numOptions || !endMinutes) return;
    setLoading(true);
    try {
      const descHash = hash.computePoseidonHashOnElements(
        Array.from(new TextEncoder().encode(description)).map((b) => b.toString()),
      );
      const endTime = Math.floor(Date.now() / 1000) + parseInt(endMinutes) * 60;

      const result = await sendAsync([
        buildCall(ADDRESSES.PRIVATE_VOTING, "create_proposal", [
          descHash,
          numOptions,
          endTime.toString(),
        ]),
      ]);
      txToast(result.transaction_hash).success();

      const currentCount = Number(proposalCount || 0);
      addProposal({
        proposalId: currentCount,
        description: description,
        optionLabels: optionLabels,
        createdAt: Date.now(),
      });

      setDescription("");
      setNumOptions("2");
      setOptionLabels(["Yes", "No"]);
      setView("proposals");

      setTimeout(() => window.location.reload(), 3000);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to create proposal");
    } finally {
      setLoading(false);
    }
  }

  async function castVote(proposalId: number, choice: number) {
    if (!address) return;
    setLoading(true);
    try {
      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const voteCommitment = await computeVoteCommitment(choice.toString(), secret, nullifierSecret);
      const nullifierHash = await computeNullifierHash(nullifierSecret);

      const result = await sendAsync([
        buildCall(ADDRESSES.PRIVATE_VOTING, "cast_vote", [
          proposalId.toString(),
          voteCommitment,
          nullifierHash,
        ]),
      ]);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "vote",
        commitment: voteCommitment,
        proposalId: proposalId,
        choice: choice.toString(),
        secret,
        nullifierSecret,
        nullifierHash,
        createdAt: Date.now(),
      });

      t.success();
      setVoteNotes(getVoteNotes());
      setExpandedProposal(null);
      setSelectedOptions({});
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to cast vote");
    } finally {
      setLoading(false);
    }
  }

  async function tallyProposal(proposalIdToTally?: number) {
    if (!address) return;
    const proposalId = proposalIdToTally ?? parseInt(tallyProposalId);
    if (isNaN(proposalId)) return;

    setLoading(true);
    try {
      const relevantNotes = voteNotes.filter((n) => n.proposalId === proposalId);

      if (relevantNotes.length === 0) {
        errorToast("No vote notes found for this proposal");
        setLoading(false);
        return;
      }

      const calldata: string[] = [proposalId.toString()];
      calldata.push(relevantNotes.length.toString());
      for (const note of relevantNotes) {
        calldata.push(note.commitment);
        calldata.push(note.choice);
        calldata.push(note.secret);
        calldata.push(note.nullifierSecret);
      }

      const result = await sendAsync([
        buildCall(ADDRESSES.PRIVATE_VOTING, "tally", calldata),
      ]);
      txToast(result.transaction_hash).success();
      setView("proposals");

      setTimeout(() => window.location.reload(), 3000);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to tally");
    } finally {
      setLoading(false);
    }
  }

  const notesByProposal = voteNotes.reduce<Record<number, VoteNote[]>>((acc, n) => {
    (acc[n.proposalId] ||= []).push(n);
    return acc;
  }, {});

  function getProposalStatus(proposal: ProposalData): { status: string; color: string } {
    const now = Math.floor(Date.now() / 1000);
    const endTime = Number(proposal.endTime);

    if (proposal.isTallied) {
      return { status: "Tallied", color: "text-[#22C55E]" };
    } else if (now >= endTime) {
      return { status: "Ended", color: "text-[#F59E0B]" };
    } else {
      return { status: "Active", color: "text-[#8B8CFF]" };
    }
  }

  function formatTimeRemaining(endTime: bigint): string {
    const now = Math.floor(Date.now() / 1000);
    const end = Number(endTime);
    const diff = end - now;

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-16">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
        <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-[#8B8CFF]/10 flex items-center justify-center">
              <Vote className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {proposalCount?.toString() || "0"}
          </div>
          <div className="text-sm text-white/40">Total Proposals</div>
        </div>

        <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-[#8B8CFF]/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{voteNotes.length}</div>
          <div className="text-sm text-white/40">Your Votes</div>
        </div>

        <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl bg-[#8B8CFF]/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {Object.keys(notesByProposal).length}
          </div>
          <div className="text-sm text-white/40">Proposals Voted</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-8 border-b border-white/[0.06] animate-fade-in-up stagger-2">
        <button
          onClick={() => setView("proposals")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            view === "proposals" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
          }`}
        >
          All Proposals
          {view === "proposals" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />
          )}
        </button>
        <button
          onClick={() => setView("create")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            view === "create" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
          }`}
        >
          Create Proposal
          {view === "create" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />
          )}
        </button>
        <button
          onClick={() => setView("tally")}
          className={`pb-3 text-sm font-semibold transition-colors relative ${
            view === "tally" ? "text-[#8B8CFF]" : "text-white/40 hover:text-white/60"
          }`}
        >
          Tally Results
          {view === "tally" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-fade-in-up stagger-3">
        {view === "proposals" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">All Proposals</h2>
                <button
                  onClick={() => setView("create")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white text-sm font-semibold transition-all"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  New Proposal
                </button>
              </div>

              {loadingProposals ? (
                <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-12 text-center">
                  <p className="text-white/60">Loading proposals...</p>
                </div>
              ) : proposals.length === 0 ? (
                <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-12 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#8B8CFF]/10 mb-4">
                    <Vote className="h-8 w-8 text-[#8B8CFF]" strokeWidth={2} />
                  </div>
                  <p className="text-white/60 mb-4">No proposals yet</p>
                  <button
                    onClick={() => setView("create")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white font-semibold transition-all"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    Create First Proposal
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals.map((proposal) => {
                    const statusInfo = getProposalStatus(proposal);
                    const userVotes = notesByProposal[proposal.id] || [];
                    const hasVoted = userVotes.length > 0;
                    const isExpanded = expandedProposal === proposal.id;
                    const numOptionsInt = parseInt(proposal.numOptions, 16);

                    return (
                      <div
                        key={proposal.id}
                        className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] hover:border-white/[0.12] transition-all overflow-hidden"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-white">
                                  {proposal.description || `Proposal #${proposal.id}`}
                                </h3>
                                <span className={`px-2 py-1 rounded-lg bg-${statusInfo.color.replace('text-', '')}/10 ${statusInfo.color} text-xs font-semibold`}>
                                  {statusInfo.status}
                                </span>
                                {hasVoted && (
                                  <span className="px-2 py-1 rounded-lg bg-[#22C55E]/10 text-[#22C55E] text-xs font-semibold">
                                    You Voted
                                  </span>
                                )}
                              </div>
                              {!proposal.description && (
                                <p className="text-sm text-white/40 font-mono">
                                  Hash: {proposal.descriptionHash.slice(0, 20)}...{proposal.descriptionHash.slice(-12)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {proposal.voteCount.toString()} vote{proposal.voteCount !== 1n ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Vote className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {numOptionsInt} option{numOptionsInt !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {formatTimeRemaining(proposal.endTime)}
                              </span>
                            </div>
                          </div>

                          {proposal.isTallied && proposal.winningOption !== undefined && (
                            <div className="rounded-xl bg-[#22C55E]/5 border border-[#22C55E]/20 p-3 mb-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" strokeWidth={2} />
                                <span className="text-sm font-semibold text-white">
                                  Winner: {(() => {
                                    const winningIndex = typeof proposal.winningOption === 'string' ? parseInt(proposal.winningOption, 16) : proposal.winningOption;
                                    return proposal.optionLabels?.[winningIndex] || `Option ${winningIndex}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Voting Interface */}
                          {!hasVoted && statusInfo.status === "Active" && (
                            <>
                              <button
                                onClick={() => setExpandedProposal(isExpanded ? null : proposal.id)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#8B8CFF]/10 hover:bg-[#8B8CFF]/20 border border-[#8B8CFF]/20 text-white text-sm font-semibold transition-all mb-3"
                              >
                                <span className="flex items-center gap-2">
                                  <Vote className="h-4 w-4" strokeWidth={2} />
                                  {isExpanded ? "Hide Voting Options" : "Vote on this Proposal"}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" strokeWidth={2} />
                                ) : (
                                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="space-y-3 p-4 rounded-xl bg-[#08090D] border border-white/[0.06]">
                                  <p className="text-sm text-white/60 mb-3">Select your choice:</p>
                                  <div className="grid gap-2">
                                    {Array.from({ length: numOptionsInt }, (_, i) => (
                                      <button
                                        key={i}
                                        onClick={() => setSelectedOptions({ ...selectedOptions, [proposal.id]: i })}
                                        className={`px-4 py-3 rounded-xl border-2 transition-all text-left ${
                                          selectedOptions[proposal.id] === i
                                            ? "border-[#8B8CFF] bg-[#8B8CFF]/10 text-white"
                                            : "border-white/[0.08] hover:border-white/[0.15] text-white/60 hover:text-white"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                            selectedOptions[proposal.id] === i
                                              ? "border-[#8B8CFF] bg-[#8B8CFF]"
                                              : "border-white/[0.15]"
                                          }`}>
                                            {selectedOptions[proposal.id] === i && (
                                              <div className="h-2 w-2 rounded-full bg-white" />
                                            )}
                                          </div>
                                          <span className="font-semibold">
                                            {proposal.optionLabels?.[i] || `Option ${i}`}
                                          </span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>

                                  <div className="rounded-xl bg-[#8B8CFF]/5 border border-[#8B8CFF]/20 p-3 mt-4">
                                    <div className="flex gap-3">
                                      <ShieldCheck className="h-5 w-5 text-[#8B8CFF] flex-shrink-0 mt-0.5" strokeWidth={2} />
                                      <div>
                                        <div className="text-xs font-semibold text-white mb-1">Private Vote</div>
                                        <div className="text-xs text-white/60 leading-relaxed">
                                          Your choice will be cryptographically hidden until the tally phase.
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => castVote(proposal.id, selectedOptions[proposal.id])}
                                    disabled={loading || !address || selectedOptions[proposal.id] === undefined}
                                    className="w-full px-4 py-3 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-3"
                                  >
                                    {loading ? "Casting Vote..." : (
                                      <>
                                        <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                                        Cast Private Vote
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </>
                          )}

                          {hasVoted && statusInfo.status === "Ended" && !proposal.isTallied && (
                            <button
                              onClick={() => setView("tally")}
                              className="w-full px-4 py-3 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                              <Eye className="h-4 w-4" strokeWidth={2} />
                              Go to Tally
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "create" && (
          <div className="max-w-2xl">
            <form onSubmit={(e) => { e.preventDefault(); createProposal(); }} className="space-y-6">
              <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Proposal Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Should we upgrade the protocol to v2?"
                    className="w-full px-4 py-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Number of Options
                    </label>
                    <input
                      type="number"
                      value={numOptions}
                      onChange={(e) => setNumOptions(e.target.value)}
                      min="2"
                      className="w-full px-4 py-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:outline-none transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Voting Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={endMinutes}
                      onChange={(e) => setEndMinutes(e.target.value)}
                      min="1"
                      className="w-full px-4 py-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Option Labels
                  </label>
                  <div className="space-y-2">
                    {optionLabels.map((label, index) => (
                      <input
                        key={index}
                        type="text"
                        value={label}
                        onChange={(e) => {
                          const newLabels = [...optionLabels];
                          newLabels[index] = e.target.value;
                          setOptionLabels(newLabels);
                        }}
                        placeholder={`Option ${index} label`}
                        className="w-full px-4 py-3 rounded-xl bg-[#08090D] border border-white/[0.08] text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:outline-none transition-colors"
                        required
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-[#8B8CFF]/5 border border-[#8B8CFF]/20 p-4">
                  <div className="flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-[#8B8CFF] flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">Private Voting</div>
                      <div className="text-sm text-white/60 leading-relaxed">
                        Votes are cryptographically hidden until the tally phase. No one can see how you voted during the active voting period.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !address}
                className="w-full px-6 py-4 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Creating..." : (
                  <>
                    <Plus className="h-5 w-5" strokeWidth={2} />
                    Create Proposal
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {view === "tally" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Tally Results</h2>
              </div>

              <div className="rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/20 p-4 mb-6">
                <div className="flex gap-3">
                  <Eye className="h-5 w-5 text-[#F59E0B] flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Reveal & Tally Votes</div>
                    <div className="text-sm text-white/60 leading-relaxed">
                      Tallying reveals all your stored votes for a proposal. This can only be executed after the voting period ends. Select an ended proposal below to tally.
                    </div>
                  </div>
                </div>
              </div>

              {loadingProposals ? (
                <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-12 text-center">
                  <p className="text-white/60">Loading proposals...</p>
                </div>
              ) : proposals.filter(p => {
                const now = Math.floor(Date.now() / 1000);
                const endTime = Number(p.endTime);
                return now >= endTime && !p.isTallied;
              }).length === 0 ? (
                <div className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] p-12 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#F59E0B]/10 mb-4">
                    <Eye className="h-8 w-8 text-[#F59E0B]" strokeWidth={2} />
                  </div>
                  <p className="text-white/60 mb-2">No proposals ready to tally</p>
                  <p className="text-sm text-white/40">Proposals can be tallied after their voting period ends</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proposals
                    .filter(p => {
                      const now = Math.floor(Date.now() / 1000);
                      const endTime = Number(p.endTime);
                      return now >= endTime && !p.isTallied;
                    })
                    .map((proposal) => {
                      const userVotes = notesByProposal[proposal.id] || [];
                      const hasVotes = userVotes.length > 0;
                      const numOptionsInt = parseInt(proposal.numOptions, 16);

                      return (
                        <div
                          key={proposal.id}
                          className="rounded-2xl bg-[#0A0B0F] border border-white/[0.08] hover:border-white/[0.12] transition-all p-6"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-white">
                                  {proposal.description || `Proposal #${proposal.id}`}
                                </h3>
                                <span className="px-2 py-1 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-semibold">
                                  Ended
                                </span>
                                {!hasVotes && (
                                  <span className="px-2 py-1 rounded-lg bg-white/5 text-white/40 text-xs font-semibold">
                                    No Votes
                                  </span>
                                )}
                              </div>
                              {!proposal.description && (
                                <p className="text-sm text-white/40 font-mono">
                                  Hash: {proposal.descriptionHash.slice(0, 20)}...{proposal.descriptionHash.slice(-12)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {proposal.voteCount.toString()} vote{proposal.voteCount !== 1n ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Vote className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {numOptionsInt} option{numOptionsInt !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <ShieldCheck className="h-4 w-4 text-white/40" strokeWidth={2} />
                              <span className="text-white/60">
                                {hasVotes ? `${userVotes.length} your vote${userVotes.length > 1 ? "s" : ""}` : "No votes"}
                              </span>
                            </div>
                          </div>

                          {hasVotes && (
                            <div className="rounded-xl bg-[#08090D] border border-white/[0.08] overflow-hidden mb-4">
                              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                <span className="text-sm font-semibold text-white">Your Votes</span>
                              </div>
                              <div className="divide-y divide-white/[0.04]">
                                {userVotes.map((note) => {
                                  const choiceIndex = parseInt(note.choice);
                                  return (
                                    <div key={note.commitment} className="px-4 py-3 flex items-center justify-between">
                                      <span className="font-mono text-sm text-white/60">
                                        {note.commitment.slice(0, 16)}...{note.commitment.slice(-8)}
                                      </span>
                                      <span className="px-2 py-1 rounded bg-[#8B8CFF]/10 text-[#8B8CFF] text-xs font-semibold">
                                        {proposal.optionLabels?.[choiceIndex] || `Option ${note.choice}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => tallyProposal(proposal.id)}
                            disabled={loading || !address || !hasVotes}
                            className="w-full px-4 py-3 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {loading ? "Tallying..." : (
                              <>
                                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                                Reveal & Tally Votes
                              </>
                            )}
                          </button>

                          {!hasVotes && (
                            <p className="text-xs text-white/40 text-center mt-2">
                              You need to have voted on this proposal to tally it
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
