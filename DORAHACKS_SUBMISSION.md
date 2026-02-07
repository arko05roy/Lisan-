# 🔒 Lisan — Private DeFi on Starknet

### A private DeFi ecosystem that looks like a wallet.

Connect ArgentX or Braavos. Deposit any token. Swap, bet on predictions, vote on governance, transfer to anyone — **all invisible on-chain.**

Nine smart contracts. One shielded pool. Zero trace back to you.

> *"Do anything on Starknet. No one knows it's you."*

---

## 🔥 The Problem

Every action on a public blockchain is visible:

| Action | What everyone sees |
|---|---|
| 🔄 You swap tokens | Your wallet, the amount, the timing — MEV bots front-run you |
| 🎲 You bet on a prediction | Your position is public — copy-traders follow your alpha |
| 🗳️ You vote on a proposal | Your ballot is visible — whales face social pressure, vote-buying is verifiable |
| 💸 You transfer funds | Sender and receiver linked forever — your financial history is one search away |
| 📤 You withdraw | Traceable straight back to your deposit |

The only privacy solution that existed — Tornado Cash — only lets you deposit and withdraw. You can't swap. You can't bet. You can't vote. And their isolated pools (0.1 ETH, 1 ETH, 10 ETH) fragment the anonymity set.

**DeFi needs a privacy ecosystem. Not a privacy feature.**

---

## 🧬 What Lisan Actually Is

Lisan isn't a mixer. It isn't a single-feature privacy tool.

It's a **full DeFi ecosystem** — an AMM, a prediction market, a governance system, a transfer layer, a relayer network — unified under one shielded pool. From the outside, it looks like a wallet. From the inside, it's everything.

| You want to... | On a public chain | On Lisan |
|---|---|---|
| 🔄 Swap tokens | Everyone sees your trade, MEV bots front-run you | Instant private swap — AMM sees the pool, not you |
| 🎲 Bet on a prediction | Your position is public, copy-traders follow you | Hidden bet — no one knows your side or size |
| 🗳️ Vote on a proposal | Your ballot is visible, whales face social pressure | Secret vote — revealed only at tally, all at once |
| 💸 Transfer funds | Sender and receiver linked forever on-chain | Shielded transfer — zero link between wallets |
| 📤 Withdraw | Traceable back to your deposit | Fresh address, unlinkable to anything you did |

**All of this from one deposit. One pool. One interface.**

---

## ⚡ Why Lisan Stands Out

🟢 **Ecosystem, not a feature** — Prediction markets + governance voting + AMM swaps + transfers + withdrawals. Not one trick — a complete private DeFi stack.

🟢 **Any ERC20** — BTC, STRK, USDC, or any token on Starknet. One unified pool for all of them. Bigger anonymity set than any isolated-pool approach.

🟢 **Wallet you already use** — ArgentX or Braavos. No new interface, no new extension, no learning curve. Privacy is added to the experience you already know.

🟢 **Instant execution** — Swaps and withdrawals happen immediately. No waiting periods, no time-locks.

🟢 **Decentralized relayers** — No centralized submitter that can be shut down. Relayers stake tokens, earn fees, get slashed for misbehavior. Privacy that can't be turned off.

🟢 **On-chain ZK verification** — Groth16 proofs verified natively on Starknet via Garaga. No offchain trust assumptions.

🟢 **Client-side proofs** — Your secrets never leave the browser. Proof generation happens locally via snarkjs.

---

## 🎲 Prediction Markets

Create markets. Place hidden bets. Claim winnings after resolution.

- Binary (YES/NO) and multi-outcome markets with oracle resolution via Pragma
- Bet commitments hide your amount and your side — **no one knows your position**
- After resolution, claim your payout with a ZK proof that proves you won without revealing your original bet
- Fair odds payout: `bet_amount × num_outcomes`, capped by pool
- Nullifier-based double-claim prevention

> A whale bets 100 BTC. On a public chain, this moves the odds and signals conviction. On Lisan, the blockchain shows "someone placed a bet" — nothing more.

---

## 🗳️ Private Governance

Cast votes that stay hidden until the tally phase. True secret ballot on-chain.

- Create proposals with custom options and configurable deadlines
- Vote commitments + nullifier hashes enforce one vote per proposal on-chain
- During voting, all choices are hidden — no signaling, no social pressure
- At tally, all votes are revealed in batch and the winner is computed automatically

> A DAO votes on treasury allocation. On a public chain, early voters influence late voters. On Lisan, everyone votes independently, and results appear all at once.

---

## 🔄 Instant Private Swaps

Swap BTC ↔ STRK on a constant-product AMM routed through the shielded pool.

- Real-time pool reserves and live swap quotes via `get_amount_out()`
- Instant execution via relayers — no trace back to your wallet
- Liquidity provision for LPs

---

## 💸 Any-ERC20 Transfers & Instant Withdrawals

- **Any ERC20 token on Starknet** — BTC, STRK, USDC, anything
- P2P shielded transfers — zero on-chain link between sender and receiver
- Instant withdrawal to any fresh address — completely unlinkable to your deposit

---

## 🧩 General Private Execution

Call **any Starknet contract** from your shielded balance via `private_execute`. The target contract sees a call from the ShieldedPool — not from you. Lisan works with protocols that don't even know Lisan exists.

---

## 🏗️ Architecture

```
You (Browser)
  │  Connect ArgentX / Braavos
  │  Deposit any ERC20 into shielded pool
  │  Generate Groth16 proof locally — secrets never leave the browser
  ▼
Relayer Network (decentralized)
  │  Receives your proof, submits on-chain
  │  Earns 0.5% fee — staking + slashing keeps them honest
  ▼
ShieldedPool (Cairo)
  │  Verifies proof on-chain via Garaga
  │  Checks nullifier (no double-spend)
  │  Updates Merkle tree
  │  Routes your action to the right contract
  ▼
┌─────────────┬──────────────┬──────────────┬──────────────┐
│ ShieldedAMM  │ Prediction   │ Private      │ Any External │
│ (swaps)      │ Market       │ Voting       │ Contract     │
│              │ (bets)       │ (governance) │ (via execute)│
└─────────────┴──────────────┴──────────────┴──────────────┘
     Target contract has no idea who you are.
```

**Privacy primitives:**
- 🔐 **Poseidon commitments** — `hash(secret, value, nullifier_secret)` hides balances and choices
- 🚫 **Nullifiers** — one-time tokens that prevent double-spending
- 🌳 **Merkle tree** — proves your commitment exists without revealing which one
- 🧮 **Groth16 proofs** — generated client-side, verified on-chain via Garaga
- 🔀 **Relayers** — decouple your wallet from the on-chain transaction

---

## 📦 What We Built

### Smart Contracts (Cairo 2.0)

| Contract | Address (Starknet Sepolia) | What it does |
|---|---|---|
| 🔒 ShieldedPool | `0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2` | Core privacy pool — deposit, withdraw, transfer, private_execute |
| 🔄 ShieldedAMM | `0x02470e8ce4fc20725d80ee8b605d48c676be5a5513d6fde6609d53980b9268a1` | Constant-product DEX (BTC ↔ STRK) |
| 🎲 PredictionMarket | `0x04de34008dc1945133c984140578059c05aedc8201da9ccfaf0f035814e3e559` | Create markets, place hidden bets, oracle resolution, ZK claim |
| 🗳️ PrivateVoting | `0x05670a0067833e25f39d0baec27ea0ce1dfb662126b469d28a4d768252f6b2b1` | Proposals, hidden votes, batch tally |
| 📡 RelayerRegistry | `0x012a228eab2513f1f9a0ba5d337d67749afe995cc73fc6849717ea37dd7e8e04` | Relayer staking, fee management, slashing |
| 🎯 RelayerCoordinator | `0x06ca449638232ced7caf36d44793271f35750deb90490d14def66cb9d2eb10ca` | Relayer selection (round-robin / fee-based) |
| ₿ MockBTC | `0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f` | Test Bitcoin token |
| ⚡ MockSTRK | `0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f` | Test Starknet token |
| 🔮 MockPragmaOracle | `0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba` | Oracle for prediction market resolution |

### 🖥️ Frontend (Next.js 16 + React 19 + TypeScript + TailwindCSS)

- 🏠 **Landing page** — hero, feature blocks, how-it-works walkthrough
- 🎲 **Prediction markets** — browse markets, place bets, claim winnings, oracle admin panel
- 🗳️ **Voting** — create proposals, cast private votes, tally results
- 🔄 **Swap** — BTC ↔ STRK with pool reserves chart and live quotes
- 📥 **Deposit** / 📤 **Withdraw** / 💸 **Transfer** — full shielded pool interaction
- 📊 **Dashboard** — portfolio overview
- 📡 **Relayer dashboard** — relayer performance and earnings
- 🧮 **Client-side ZK proof generation** — snarkjs + circomlibjs in browser

### 🧪 Tests (Starknet Foundry)

- `test_prediction_market.cairo` — market creation, betting, resolution, claim
- `test_private_voting.cairo` — proposal creation, voting, tally
- `test_shielded_amm.cairo` — swaps, liquidity
- `test_deposit.cairo`, `test_withdraw.cairo`, `test_transfer.cairo`
- `test_integration.cairo` — full deposit → action → withdraw flows

---

## ⚔️ Lisan vs Tornado Cash

| | Tornado Cash | Lisan |
|---|---|---|
| 🧠 Philosophy | Privacy tool | **Private DeFi ecosystem** |
| 🏊 Pool structure | Isolated per amount (0.1, 1, 10 ETH) | Unified — all amounts, all tokens |
| 📊 Anonymity set | Small (per pool) | Large (entire platform) |
| ⚡ What you can do | Deposit → Withdraw | Deposit → Swap → Bet → Vote → Transfer → Withdraw |
| 🎲 Prediction markets | ❌ | ✅ Hidden positions, ZK claims |
| 🗳️ Private voting | ❌ | ✅ Secret until tally |
| 🔗 Cross-contract calls | ❌ | ✅ `private_execute` to any contract |
| 🪙 Token support | Few fixed pools | Any ERC20 on Starknet |
| 👛 Wallet UX | Custom interface | ArgentX / Braavos — wallets you already use |
| 📡 Relayers | Centralized (shut down 2022) | Decentralized — staking + slashing |
| ✅ Proof verification | Offchain | On-chain via Garaga |
| 💰 Cost | Ethereum L1 gas | Starknet L2 |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Cairo 2.0 (Starknet) |
| ZK Verification | Groth16 via Garaga |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS |
| Proof Generation | snarkjs + circomlibjs (client-side) |
| Wallet | starknet-react, starknetkit (ArgentX, Braavos) |
| Oracle | Pragma (MockPragmaOracle on testnet) |
| Testing | Starknet Foundry (snforge) |

---

## 🎯 Target Tracks

### ₿ Bitcoin Track
Lisan makes BTC a first-class DeFi asset on Starknet. Deposit BTC, then swap, bet on prediction markets, vote in DAOs, and withdraw — all privately. Bitcoin's ethos of privacy and censorship resistance, with DeFi composability.

### 🔒 Privacy Track
Privacy infrastructure for the entire Starknet ecosystem. Garaga for on-chain ZK verification, any ERC20 supported, any contract reachable via `private_execute`. Decentralized relayers ensure censorship resistance.

---

## 👤 Team

**Solo builder** — full-stack blockchain developer. Cairo, Rust, TypeScript, ZK circuits.

Previous results: Avalanche P1 (privacy infrastructure), CELO P3 (L3 blockchain), ETH Global 1inch track prize.

---

## 🗺️ Roadmap

**Now:** BTC + STRK support, prediction markets, voting, AMM swaps, decentralized relayers — all deployed on Sepolia.

**Next:** Multi-asset expansion (USDC, ETH), integration with live Starknet AMMs (Ekubo, JediSwap), mobile wallet support.

**Later:** Security audit, mainnet deployment, cross-chain privacy (Bitcoin L1 ↔ Starknet L2).

---

> *From the outside, it looks like a wallet. From the inside, it's everything.*

Built for [RE{DEFINE} Hackathon](https://redefine.starknet.io) 2026.
