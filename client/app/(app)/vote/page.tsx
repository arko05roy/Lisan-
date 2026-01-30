"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADDRESSES } from "@/lib/addresses";
import { PRIVATE_VOTING_ABI } from "@/lib/abis";
import { generateSecret, computeVoteCommitment, computeNullifierHash } from "@/lib/crypto";
import { addNote, getVoteNotes, VoteNote } from "@/lib/storage";
import { buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { hash } from "starknet";

export default function VotePage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  // Create proposal state
  const [description, setDescription] = useState("");
  const [numOptions, setNumOptions] = useState("2");
  const [endMinutes, setEndMinutes] = useState("60");

  // Cast vote state
  const [voteProposalId, setVoteProposalId] = useState("");
  const [voteChoice, setVoteChoice] = useState("0");

  // Tally state
  const [tallyProposalId, setTallyProposalId] = useState("");
  const [voteNotes, setVoteNotes] = useState<VoteNote[]>([]);

  const [loading, setLoading] = useState(false);

  const { data: proposalCount } = useReadContract({
    address: ADDRESSES.PRIVATE_VOTING as `0x${string}`,
    abi: PRIVATE_VOTING_ABI,
    functionName: "get_proposal_count",
    args: [],
  });

  useEffect(() => {
    setVoteNotes(getVoteNotes());
  }, []);

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
      setDescription("");
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to create proposal");
    } finally {
      setLoading(false);
    }
  }

  async function castVote() {
    if (!address || !voteProposalId) return;
    setLoading(true);
    try {
      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const voteCommitment = computeVoteCommitment(voteChoice, secret, nullifierSecret);
      const nullifierHash = computeNullifierHash(nullifierSecret);

      const result = await sendAsync([
        buildCall(ADDRESSES.PRIVATE_VOTING, "cast_vote", [
          voteProposalId,
          voteCommitment,
          nullifierHash,
        ]),
      ]);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "vote",
        commitment: voteCommitment,
        proposalId: parseInt(voteProposalId),
        choice: voteChoice,
        secret,
        nullifierSecret,
        nullifierHash,
        createdAt: Date.now(),
      });

      t.success();
      setVoteNotes(getVoteNotes());
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to cast vote");
    } finally {
      setLoading(false);
    }
  }

  async function tallyProposal() {
    if (!address || !tallyProposalId) return;
    setLoading(true);
    try {
      const proposalId = parseInt(tallyProposalId);
      const relevantNotes = voteNotes.filter((n) => n.proposalId === proposalId);

      if (relevantNotes.length === 0) {
        errorToast("No vote notes found for this proposal");
        setLoading(false);
        return;
      }

      // Build revealed_votes array for the tally call
      // Span is encoded as: [length, ...elements]
      // Each RevealedVote: vote_commitment, choice, secret, nullifier_secret
      const calldata: string[] = [tallyProposalId];
      // Span length
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
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to tally");
    } finally {
      setLoading(false);
    }
  }

  // Group vote notes by proposal
  const notesByProposal = voteNotes.reduce<Record<number, VoteNote[]>>((acc, n) => {
    (acc[n.proposalId] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Private Voting</h1>
        <p className="text-muted-foreground">
          Create proposals, cast private votes, and tally results
        </p>
        {proposalCount !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {proposalCount?.toString() || "0"} proposals created
          </p>
        )}
      </div>

      <Tabs defaultValue="vote">
        <TabsList className="w-full">
          <TabsTrigger value="create" className="flex-1">Create</TabsTrigger>
          <TabsTrigger value="vote" className="flex-1">Vote</TabsTrigger>
          <TabsTrigger value="tally" className="flex-1">Tally</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Proposal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Description</Label>
                <Input
                  placeholder="Should we upgrade the protocol?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label>Number of Options</Label>
                <Input
                  type="number"
                  min="2"
                  value={numOptions}
                  onChange={(e) => setNumOptions(e.target.value)}
                />
              </div>
              <div>
                <Label>Voting Duration (minutes from now)</Label>
                <Input
                  type="number"
                  value={endMinutes}
                  onChange={(e) => setEndMinutes(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={loading || !address} onClick={createProposal}>
                {loading ? "Processing..." : "Create Proposal"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vote">
          <Card>
            <CardHeader>
              <CardTitle>Cast Vote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Proposal ID</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={voteProposalId}
                  onChange={(e) => setVoteProposalId(e.target.value)}
                />
              </div>
              <div>
                <Label>Choice (0-indexed option)</Label>
                <Input
                  type="number"
                  min="0"
                  value={voteChoice}
                  onChange={(e) => setVoteChoice(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your vote is private. The commitment hides your choice until tally.
              </p>
              <Button className="w-full" disabled={loading || !address} onClick={castVote}>
                {loading ? "Processing..." : "Cast Vote"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tally">
          <Card>
            <CardHeader>
              <CardTitle>Tally Proposal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Proposal ID</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={tallyProposalId}
                  onChange={(e) => setTallyProposalId(e.target.value)}
                />
              </div>

              {tallyProposalId && notesByProposal[parseInt(tallyProposalId)] && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Your votes for proposal #{tallyProposalId}:
                  </p>
                  {notesByProposal[parseInt(tallyProposalId)].map((n) => (
                    <div key={n.commitment} className="flex items-center justify-between rounded bg-muted p-2 text-xs">
                      <span className="font-mono">{n.commitment.slice(0, 12)}...</span>
                      <Badge variant="outline">Choice {n.choice}</Badge>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Tally reveals all stored vote notes for this proposal. Can only be called after voting ends.
              </p>
              <Button className="w-full" disabled={loading || !address || !tallyProposalId} onClick={tallyProposal}>
                {loading ? "Processing..." : "Tally Votes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
