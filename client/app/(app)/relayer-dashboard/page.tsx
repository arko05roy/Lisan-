"use client";

import { useState, useEffect } from "react";
import { useAccount, useContract, useProvider } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, DollarSign, TrendingUp, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { ADDRESSES } from "@/lib/addresses";
import { toast } from "sonner";
import { Contract, type Abi, RpcProvider, CallData } from "starknet";

// ABI for RelayerRegistry (add actual ABI from compiled contract)
const RELAYER_REGISTRY_ABI = [
  {
    "type": "function",
    "name": "register_relayer",
    "inputs": [{ "name": "stake_amount", "type": "core::integer::u256" }],
    "outputs": [{ "type": "core::integer::u256" }],
    "state_mutability": "external"
  },
  {
    "type": "function",
    "name": "unregister_relayer",
    "inputs": [{ "name": "relayer_id", "type": "core::integer::u256" }],
    "outputs": [],
    "state_mutability": "external"
  },
  {
    "type": "function",
    "name": "claim_earnings",
    "inputs": [],
    "outputs": [],
    "state_mutability": "external"
  },
  {
    "type": "function",
    "name": "get_relayer_info",
    "inputs": [{ "name": "relayer_id", "type": "core::integer::u256" }],
    "outputs": [{
      "type": "(core::starknet::contract_address::ContractAddress, core::integer::u256, core::bool, core::integer::u256, core::integer::u256, core::integer::u256, core::integer::u64)"
    }],
    "state_mutability": "view"
  },
  {
    "type": "function",
    "name": "get_relayer_count",
    "inputs": [],
    "outputs": [{ "type": "core::integer::u256" }],
    "state_mutability": "view"
  },
  {
    "type": "function",
    "name": "get_active_relayer_count",
    "inputs": [],
    "outputs": [{ "type": "core::integer::u256" }],
    "state_mutability": "view"
  },
  {
    "type": "function",
    "name": "get_min_stake",
    "inputs": [],
    "outputs": [{ "type": "core::integer::u256" }],
    "state_mutability": "view"
  }
];

const ERC20_ABI = [
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      { "name": "spender", "type": "core::starknet::contract_address::ContractAddress" },
      { "name": "amount", "type": "core::integer::u256" }
    ],
    "outputs": [{ "type": "core::bool" }],
    "state_mutability": "external"
  },
  {
    "type": "function",
    "name": "balance_of",
    "inputs": [{ "name": "account", "type": "core::starknet::contract_address::ContractAddress" }],
    "outputs": [{ "type": "core::integer::u256" }],
    "state_mutability": "view"
  }
];

interface RelayerInfo {
  relayerId: string;
  address: string;
  stake: bigint;
  active: boolean;
  totalSubmissions: number;
  failedSubmissions: number;
  successRate: number;
  totalEarnings: bigint;
}

export default function RelayerDashboardPage() {
  const { address, account } = useAccount();
  const { provider } = useProvider();

  const [allRelayers, setAllRelayers] = useState<RelayerInfo[]>([]);
  const [userRelayer, setUserRelayer] = useState<RelayerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [minStake, setMinStake] = useState<bigint>(0n);
  const [stakeAmount, setStakeAmount] = useState("1");
  const [registering, setRegistering] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (provider && ADDRESSES.RELAYER_REGISTRY) {
      fetchRelayers();
      const interval = setInterval(fetchRelayers, 10000);
      return () => clearInterval(interval);
    }
  }, [provider, address]);

  const fetchRelayers = async () => {
    if (!provider || !ADDRESSES.RELAYER_REGISTRY) return;

    try {
      const registry = new Contract({ abi: RELAYER_REGISTRY_ABI as Abi, address: ADDRESSES.RELAYER_REGISTRY, providerOrAccount: provider });

      // Get min stake
      const minStakeResult = await registry.get_min_stake();
      setMinStake(BigInt(minStakeResult));

      // Get relayer count
      const countResult = await registry.get_relayer_count();
      const count = Number(countResult);

      const relayerData: RelayerInfo[] = [];

      for (let i = 1; i <= count; i++) {
        try {
          const info = await registry.get_relayer_info(i);

          // Parse the tuple response — address comes back as BigInt from contract
          const relayerAddress = "0x" + BigInt(info[0]).toString(16);
          const stake = BigInt(info[1]);
          const active = info[2];
          const totalSubmissions = Number(info[3]);
          const failedSubmissions = Number(info[4]);
          const totalEarnings = BigInt(info[5]);

          const successRate = totalSubmissions > 0
            ? ((totalSubmissions - failedSubmissions) / totalSubmissions) * 100
            : 0;

          const relayerInfo: RelayerInfo = {
            relayerId: i.toString(),
            address: relayerAddress,
            stake,
            active,
            totalSubmissions,
            failedSubmissions,
            successRate,
            totalEarnings,
          };

          relayerData.push(relayerInfo);

          // Check if this is the user's relayer (compare as BigInt to handle casing/padding)
          if (address && BigInt(relayerAddress) === BigInt(address)) {
            setUserRelayer(relayerInfo);
          }
        } catch (err) {
          console.error(`Error fetching relayer ${i}:`, err);
        }
      }

      setAllRelayers(relayerData);
    } catch (error) {
      console.error("Error fetching relayers:", error);
      toast.error("Failed to fetch relayer data");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!account || !address || !ADDRESSES.RELAYER_REGISTRY || !ADDRESSES.MOCK_BTC) return;

    setRegistering(true);

    try {
      // Parse decimal input (e.g. "2.3") into wei (integer)
      const parts = stakeAmount.split(".");
      const whole = parts[0] || "0";
      const frac = (parts[1] || "").padEnd(18, "0").slice(0, 18);
      const stakeAmountWei = BigInt(whole) * 10n ** 18n + BigInt(frac);

      // Batch approve + register into a single multicall (one wallet popup)
      toast.loading("Approve & Register (confirm in wallet)...");
      const tx = await account.execute([
        {
          contractAddress: ADDRESSES.MOCK_BTC,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: ADDRESSES.RELAYER_REGISTRY,
            amount: { low: stakeAmountWei.toString(), high: "0" },
          }),
        },
        {
          contractAddress: ADDRESSES.RELAYER_REGISTRY,
          entrypoint: "register_relayer",
          calldata: CallData.compile({
            stake_amount: { low: stakeAmountWei.toString(), high: "0" },
          }),
        },
      ]);
      toast.loading("Waiting for confirmation...");
      await (provider as unknown as RpcProvider).waitForTransaction(tx.transaction_hash);

      toast.success("Successfully registered as relayer!");
      await fetchRelayers();
    } catch (error: unknown) {
      console.error("Registration error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Registration failed: ${msg.slice(0, 120)}`);
    } finally {
      setRegistering(false);
    }
  };

  const handleClaimEarnings = async () => {
    if (!account || !address || !ADDRESSES.RELAYER_REGISTRY) return;

    setClaiming(true);

    try {
      toast.loading("Claiming earnings (confirm in wallet)...");
      const claimTx = await account.execute([{
        contractAddress: ADDRESSES.RELAYER_REGISTRY,
        entrypoint: "claim_earnings",
        calldata: [],
      }]);
      toast.loading("Waiting for claim confirmation...");
      await (provider as unknown as RpcProvider).waitForTransaction(claimTx.transaction_hash);

      toast.success("Successfully claimed earnings!");
      await fetchRelayers();
    } catch (error: unknown) {
      console.error("Claim error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Claim failed: ${msg.slice(0, 120)}`);
    } finally {
      setClaiming(false);
    }
  };

  const formatBTC = (wei: bigint) => {
    return (Number(wei) / 1e18).toFixed(4);
  };

  const formatAddress = (addr: string) => {
    const s = typeof addr === "string" ? addr : "0x" + BigInt(addr).toString(16);
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  };

  if (!ADDRESSES.RELAYER_REGISTRY) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Relayer Dashboard</CardTitle>
            <CardDescription>
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                Relayer network not configured. Please set NEXT_PUBLIC_RELAYER_REGISTRY in .env.local
              </div>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Relayer Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your relayer registration and view all active relayers in the network
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Relayers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allRelayers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Relayers</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allRelayers.filter(r => r.active).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Min Stake Required</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBTC(minStake)} mBTC</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value Staked</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBTC(allRelayers.reduce((sum, r) => sum + r.stake, 0n))} mBTC
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Relayer Section */}
      {!userRelayer && address ? (
        <Card>
          <CardHeader>
            <CardTitle>Register as Relayer</CardTitle>
            <CardDescription>
              Stake mBTC to become a relayer and earn fees from processing transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stake">Stake Amount (mBTC)</Label>
              <Input
                id="stake"
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder={`Min: ${formatBTC(minStake)}`}
                min={Number(formatBTC(minStake))}
                step="0.1"
              />
            </div>
            <Button
              onClick={handleRegister}
              disabled={registering || Number(stakeAmount) < Number(formatBTC(minStake))}
              className="w-full"
            >
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register as Relayer"
              )}
            </Button>
          </CardContent>
        </Card>
      ) : userRelayer ? (
        <Card>
          <CardHeader>
            <CardTitle>Your Relayer Stats</CardTitle>
            <CardDescription>Relayer ID #{userRelayer.relayerId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="flex items-center gap-2 mt-1">
                  {userRelayer.active ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <Badge variant="default" className="bg-green-600">Active</Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <Badge variant="destructive">Inactive</Badge>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Stake</div>
                <div className="text-lg font-semibold">{formatBTC(userRelayer.stake)} mBTC</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Submissions</div>
                <div className="text-lg font-semibold">{userRelayer.totalSubmissions}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
                <div className="text-lg font-semibold">{userRelayer.successRate.toFixed(1)}%</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Earnings Available</div>
                <div className="text-2xl font-bold">{formatBTC(userRelayer.totalEarnings)} mBTC</div>
              </div>
              <Button
                onClick={handleClaimEarnings}
                disabled={claiming || userRelayer.totalEarnings === 0n}
              >
                {claiming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  "Claim Earnings"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* All Relayers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Relayers</CardTitle>
          <CardDescription>View all relayers in the network (auto-refreshes every 10s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : allRelayers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No relayers registered yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Address</th>
                    <th className="text-left py-3 px-4">Stake</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-right py-3 px-4">Submissions</th>
                    <th className="text-right py-3 px-4">Success Rate</th>
                    <th className="text-right py-3 px-4">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {allRelayers.map((relayer) => (
                    <tr
                      key={relayer.relayerId}
                      className={`border-b hover:bg-muted/50 ${relayer.address === address ? 'bg-primary/5' : ''}`}
                    >
                      <td className="py-3 px-4 font-mono">#{relayer.relayerId}</td>
                      <td className="py-3 px-4 font-mono text-sm">{formatAddress(relayer.address)}</td>
                      <td className="py-3 px-4">{formatBTC(relayer.stake)} mBTC</td>
                      <td className="py-3 px-4">
                        {relayer.active ? (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">{relayer.totalSubmissions}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={relayer.successRate >= 95 ? 'text-green-600 font-semibold' : ''}>
                          {relayer.successRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">{formatBTC(relayer.totalEarnings)} mBTC</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
