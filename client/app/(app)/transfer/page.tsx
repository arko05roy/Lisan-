"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { getPoolNotes } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ArrowDownUp, Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADDRESSES } from "@/lib/addresses";

export default function TransferPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<"send" | "transfer" | "receive">("send");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedNote, setSelectedNote] = useState("");

  const poolNotes = typeof window !== "undefined" ? getPoolNotes().filter((n) => !n.spent) : [];

  const getTokenLabel = (tokenAddress: string) => {
    if (tokenAddress === ADDRESSES.MOCK_BTC) return "mBTC";
    if (tokenAddress === ADDRESSES.MOCK_STRK) return "mSTRK";
    if (tokenAddress === ADDRESSES.DEMO_TOKEN) return "DEMO";
    return tokenAddress.slice(0, 8) + "...";
  };

  return (
    <div className="max-w-[600px] mx-auto pt-8">
      {/* Main Card */}
      <div className="bg-[#0D1117] rounded-3xl border border-white/[0.06] shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center justify-center gap-12 px-8 pt-8 pb-6 border-b border-white/[0.04]">
          <button
            onClick={() => setActiveTab("send")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "send"
                ? "text-[#8B8CFF]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Send
            {activeTab === "send" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("transfer")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "transfer"
                ? "text-[#8B8CFF]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Transfer
            {activeTab === "transfer" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("receive")}
            className={`pb-3 text-base font-semibold transition-colors relative ${
              activeTab === "receive"
                ? "text-[#8B8CFF]"
                : "text-white/40 hover:text-white/60"
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
              {/* Send From */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-white">Send from</Label>
                <Select value={selectedNote} onValueChange={setSelectedNote}>
                  <SelectTrigger className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white hover:bg-white/[0.06] transition-colors">
                    <SelectValue placeholder={address ? `${address.slice(0, 10)}...${address.slice(-6)}` : "Connect wallet"} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D23] border-white/[0.08]">
                    {poolNotes.length === 0 ? (
                      <SelectItem value="none" disabled className="text-white/40">No shielded notes available</SelectItem>
                    ) : (
                      poolNotes.map((note) => (
                        <SelectItem key={note.commitment} value={note.commitment} className="text-white">
                          {getTokenLabel(note.tokenAddress)} - {(Number(BigInt(note.amount)) / 10 ** 18).toFixed(4)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Send To */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-white">Send to</Label>
                <Input
                  placeholder="Enter public address (0x) or ENS name"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                />
              </div>

              {/* Asset */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-white">Asset</Label>
                <Select>
                  <SelectTrigger className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white hover:bg-white/[0.06] transition-colors">
                    <SelectValue placeholder="Select Asset" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1D23] border-white/[0.08]">
                    <SelectItem value="mbtc" className="text-white">mBTC</SelectItem>
                    <SelectItem value="mstrk" className="text-white">mSTRK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-3">
                <Label className="text-base font-bold text-white">Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-14 bg-white/[0.04] border-white/[0.08] rounded-xl text-base text-white placeholder:text-white/40 focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                />
              </div>

              {/* Send Button */}
              <div className="pt-4">
                <Button
                  disabled={!recipient || !amount || !selectedNote}
                  className="w-full h-14 bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white rounded-xl text-base font-bold shadow-lg shadow-[#8B8CFF]/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                >
                  Send
                </Button>
              </div>
            </>
          )}

          {activeTab === "transfer" && (
            <div className="text-center py-12">
              <ArrowDownUp className="h-12 w-12 mx-auto mb-4 text-white/20" />
              <p className="text-base text-white/60">Transfer between your accounts</p>
            </div>
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
    </div>
  );
}

