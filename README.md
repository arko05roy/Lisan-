<div align="center">

# Lisan

**Private Bitcoin DeFi on Starknet.**

Deposit BTC. Swap, bet, vote, call any contract — privately.<br/>
One shielded pool. Any ERC20. Zero trace back to you.

[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-blue?style=flat-square)](https://sepolia.starkscan.co/) [![Cairo](https://img.shields.io/badge/Cairo-2.0-orange?style=flat-square)]() [![Contracts](https://img.shields.io/badge/Contracts-9-green?style=flat-square)]() [![ZK](https://img.shields.io/badge/ZK-Groth16%20%C3%97%20Garaga-purple?style=flat-square)]() [![License](https://img.shields.io/badge/License-MIT-white?style=flat-square)]()

[Launch App](https://lisan-gamma.vercel.app/) &middot; [Architecture](#architecture) &middot; [Contracts](#deployed-contracts-starknet-sepolia) &middot; [Video Demo](#demo)

</div>

---

> *"Bitcoin on Starknet can transfer. Lisan makes it do everything else — privately."*

Tornado Cash hid transfers. **Lisan makes Bitcoin productive.**

Connect ArgentX or Braavos — the wallets you already use. Deposit BTC (or any ERC20) into a shielded pool. From there, every action is private and mempool-blind: swap without front-running, bet without copy-traders, vote without social pressure, call any contract without revealing your identity. The target contract only sees Lisan called it.

Nine smart contracts. Five DeFi primitives. One unified anonymity set.

---

## The Problem

Every DeFi action on a public chain leaks your intent:

| Action | What's exposed | Who exploits it |
|---|---|---|
| Swap tokens | Trade size, direction, timing | MEV bots front-run you |
| Place a bet | Position, size, conviction | Copy-traders mirror you |
| Cast a vote | Your choice, your wallet | Vote buyers, social pressure |
| Transfer funds | Sender ↔ receiver link | Chain analysis, surveillance |
| Call a contract | Your wallet, your calldata | Anyone watching the mempool |

Existing privacy solutions (Tornado Cash, mixers) only cover transfers, only support a few tokens, require batching and waiting, and were shut down because of centralized relayers.

**Lisan fixes all of this.**

---

## What You Can Do

| | Public chain | Lisan |
|---|---|---|
| **Swap** | Everyone sees your trade | Instant private swap — AMM sees the pool, not you |
| **Predict** | Your position is public | Hidden bet — no one knows your side or size |
| **Vote** | Your ballot is visible | Secret vote — revealed only at tally |
| **Transfer** | Sender and receiver linked forever | Shielded transfer — zero link between wallets |
| **Execute** | Your wallet calls the contract | Lisan calls it — target has no idea who you are |
| **Withdraw** | Traceable to your deposit | Fresh address, unlinkable to anything you did |

**All from one deposit. One pool. One interface.**

---

## Architecture

```
You (Browser)
  │  Connect ArgentX / Braavos
  │  Deposit any ERC20 into shielded pool
  │  Generate Groth16 proof locally — secrets never leave the browser
  ▼
Relayer Network (decentralized)
  │  Receives your proof, submits on-chain
  │  Earns fees — staking + slashing keeps them honest
  ▼
ShieldedPool (Cairo)
  │  Verifies ZK proof on-chain via Garaga
  │  Checks nullifier (no double-spend)
  │  Updates Merkle tree
  │  Routes action to target contract
  ▼
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ ShieldedAMM  │ Prediction   │ Private      │ Any External │
│ (swaps)      │ Market       │ Voting       │ Contract     │
│ BTC ↔ STRK   │ (hidden bets)│ (secret      │ (via private │
│ x*y=k        │ Pragma oracle│  ballots)    │  execute)    │
└──────────────┴──────────────┴──────────────┴──────────────┘
          Target contract has no idea who you are.
```

**Privacy primitives under the hood:**

| Primitive | What it does |
|---|---|
| **Poseidon commitments** | `hash(amount, token, secret, nullifier_secret)` — hides balances and choices |
| **Nullifiers** | One-time tokens that prevent double-spending across all primitives |
| **Merkle tree** | Proves your commitment exists without revealing which one |
| **Groth16 proofs** | Generated client-side via snarkjs, verified on-chain via Garaga |
| **Decentralized relayers** | Decouple your wallet from the on-chain transaction — staked, slashable, unstoppable |

---

## Features

### Private Prediction Markets
Create markets. Place hidden bets. Claim winnings with a ZK proof.

- Binary and multi-outcome markets with oracle resolution via **Pragma**
- Bet commitments hide your amount AND your side — no one knows your position
- After resolution, prove you won without revealing your original bet
- Nullifier-based double-claim prevention

> *A whale bets 100 BTC on a public chain — copy-traders follow instantly. On Lisan, the chain shows "someone placed a bet." Nothing more.*

### Private Governance
True secret ballot on-chain. No signaling, no social pressure.

- Create proposals with custom options and configurable deadlines
- All votes are hidden during the voting period
- At tally, votes are revealed in batch and the winner is computed automatically
- One vote per proposal enforced on-chain via nullifiers

> *A DAO votes on treasury allocation. On a public chain, early voters influence late voters. On Lisan, everyone votes independently — results appear all at once.*

### Private Swaps
Swap BTC ↔ STRK on a constant-product AMM routed through the shielded pool.

- Real-time reserves and live quotes via `get_amount_out()`
- Instant execution via relayers — zero front-running, zero trace
- Liquidity provision for LPs

### Private Transfers & Withdrawals
- **Any ERC20** on Starknet — BTC, STRK, USDC, anything
- P2P shielded transfers — zero on-chain link between sender and receiver
- Instant withdrawal to any fresh address — unlinkable to your deposit

### General Private Execution
Call **any Starknet contract** from your shielded balance via `private_execute`. The target contract sees a call from the ShieldedPool — not from you. Lisan works with protocols that don't even know Lisan exists.

---

## Lisan vs Tornado Cash

| | Tornado Cash | Lisan |
|---|---|---|
| **Philosophy** | Privacy tool | Private DeFi ecosystem |
| **Pool structure** | Isolated per amount (0.1, 1, 10 ETH) | Unified — all amounts, all tokens |
| **Anonymity set** | Small (per pool) | Large (entire platform) |
| **Capabilities** | Deposit → Withdraw | Deposit → Swap → Bet → Vote → Transfer → Execute → Withdraw |
| **Prediction markets** | No | Hidden positions, ZK claims |
| **Private voting** | No | Secret until tally |
| **Cross-contract calls** | No | `private_execute` to any contract |
| **Token support** | Few fixed pools | Any ERC20 on Starknet |
| **Wallet UX** | Custom interface | ArgentX / Braavos |
| **Relayers** | Centralized (shut down 2022) | Decentralized — staking + slashing |
| **Proof verification** | Offchain | On-chain via Garaga |
| **Cost** | Ethereum L1 gas | Starknet L2 |

---

## Deployed Contracts (Starknet Sepolia)

All contracts are live and verified on Sepolia testnet:

| Contract | Address |
|---|---|
| ShieldedPool | [`0x0115...1ff2`](https://sepolia.starkscan.co/contract/0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2) |
| ShieldedAMM | [`0x0247...68a1`](https://sepolia.starkscan.co/contract/0x02470e8ce4fc20725d80ee8b605d48c676be5a5513d6fde6609d53980b9268a1) |
| PredictionMarket | [`0x04de...e559`](https://sepolia.starkscan.co/contract/0x04de34008dc1945133c984140578059c05aedc8201da9ccfaf0f035814e3e559) |
| PrivateVoting | [`0x0567...f5b1`](https://sepolia.starkscan.co/contract/0x05670a0067833e25f39d0baec27ea0ce1dfb662126b469d28a4d768252f6b2b1) |
| RelayerRegistry | [`0x012a...8e04`](https://sepolia.starkscan.co/contract/0x012a228eab2513f1f9a0ba5d337d67749afe995cc73fc6849717ea37dd7e8e04) |
| RelayerCoordinator | [`0x06ca...10ca`](https://sepolia.starkscan.co/contract/0x06ca449638232ced7caf36d44793271f35750deb90490d14def66cb9d2eb10ca) |
| BTC | [`0x03ff...ba8f`](https://sepolia.starkscan.co/contract/0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f) |
| STRK | [`0x023d...d37f`](https://sepolia.starkscan.co/contract/0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f) |
| PragmaOracle | [`0x07c5...d8ba`](https://sepolia.starkscan.co/contract/0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Cairo 2.0 (Starknet) |
| ZK Verification | Groth16 via Garaga BN254 |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS |
| Proof Generation | snarkjs + circomlibjs (client-side) |
| Wallet Integration | starknet-react, starknetkit (ArgentX, Braavos) |
| Oracle | Pragma |
| Testing | Starknet Foundry (snforge) |

---

## Project Structure

```
lisan/
├── client/                           # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   └── (app)/
│   │       ├── dashboard/            # Portfolio overview
│   │       ├── deposit/              # Deposit into pool
│   │       ├── withdraw/             # Withdraw from pool
│   │       ├── swap/                 # Shielded AMM
│   │       ├── predict/              # Prediction markets
│   │       ├── vote/                 # Private voting
│   │       ├── transfer/             # P2P transfers
│   │       └── execute/              # Custom contract calls
│   └── lib/
│       ├── crypto.ts                 # Commitment generation
│       ├── prover.ts                 # ZK proof generation
│       ├── merkle.ts                 # Merkle tree logic
│       └── relay.ts                  # Relayer API
│
├── lisan_contracts/                  # Cairo smart contracts
│   ├── src/
│   │   ├── shielded_pool.cairo       # Core privacy pool (multi-asset)
│   │   ├── shielded_amm.cairo        # Private DEX (x*y=k)
│   │   ├── prediction_market.cairo   # Private betting + Pragma oracle
│   │   ├── private_voting.cairo      # Secret governance + time-lock
│   │   ├── relayer_registry.cairo    # Relayer staking & fees
│   │   ├── relayer_coordinator.cairo # Relayer selection
│   │   ├── merkle_tree.cairo         # Merkle proofs
│   │   └── commitment.cairo          # Poseidon commitments
│   └── tests/
│
└── circuits/                         # Groth16 circuit definitions
```

---

## Getting Started

### Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) (Cairo package manager)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/)
- Node.js 18+

### Contracts

```bash
cd lisan_contracts
scarb build
snforge test
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect ArgentX or Braavos on Sepolia.

---

<details>
<summary><b>Contract API Reference</b></summary>

### ShieldedPool
```cairo
deposit(token, amount, commitment)                       → enter pool
transfer(proof, root, nullifier, ...)                    → P2P transfer
prepare_withdraw(proof, root, nullifier, token, amount)  → stage exit
claim_withdrawal(nullifier, recipient)                   → finalize
private_execute(proof, ..., target, calldata, ...)       → call any contract
```

### ShieldedAMM
```cairo
swap(proof, root, nullifier, ..., amount_in, min_out)    → private swap
add_liquidity(token_a_amount, token_b_amount)            → seed pool
get_amount_out(amount_in, reserve_in, reserve_out)       → quote
```

### PredictionMarket
```cairo
create_market(question_hash, num_outcomes, resolution_time) → market_id
place_bet(market_id, bet_commitment, amount)                → hidden position
resolve(market_id)                                          → queries oracle
claim(market_id, proof, bet_commitment, nullifier, recipient) → payout
```

### PrivateVoting
```cairo
create_proposal(description_hash, num_options, end_time) → proposal_id
cast_vote(proposal_id, vote_commitment, nullifier_hash)  → hidden vote
tally(proposal_id, revealed_votes[])                     → results + winner
```

</details>

---


<div align="center">

**MIT License**

Built for [RE{DEFINE} Hackathon](https://redefine.starknet.io) 2026.

*Bitcoin on Starknet can transfer. Lisan makes it do everything — privately.*

</div>
