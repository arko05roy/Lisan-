# Lisan — Private DeFi on Starknet

Privacy layer for Starknet that lets you swap tokens, bet on prediction markets, vote on governance proposals, and transfer funds — all from a shielded balance. No one knows it's you.

---

## The Problem

Every action on a public blockchain is visible:

- **Prediction markets** — your bet on "ETH hits $5000" is public. Copy-traders front-run your alpha. Market makers adjust odds the moment a whale places a position.
- **Governance voting** — your DAO vote is visible to everyone. Whales face social pressure. Vote-buying is trivially verifiable. True democratic governance doesn't exist when every ballot is public.
- **Trading** — MEV bots watch every swap. Front-runners extract $500M+ annually from DeFi users.
- **Transfers** — every payment you make is traceable. Your entire financial history is one block explorer search away.

Existing privacy solutions (Tornado Cash) only let you deposit and withdraw. You can't actually *do* anything private — no swaps, no bets, no votes. And their isolated pools (0.1 ETH, 1 ETH, 10 ETH) fragment the anonymity set.

---

## The Solution

Lisan is a unified shielded pool where you connect your existing wallet — ArgentX or Braavos — deposit any ERC20 token, and interact with DeFi protocols without revealing your identity. Instant swaps, instant withdrawals, familiar UX. ZK proofs verify everything client-side. A decentralized relayer network submits your transactions so there's no on-chain link back to your wallet.

### Private Prediction Markets

Create markets, place hidden bets, claim winnings after resolution.

- Binary (YES/NO) and multi-outcome markets with oracle resolution via Pragma
- Bet commitments hide your amount and your side — no one knows your position
- After the market resolves, claim your payout with a ZK proof that proves you won without revealing your original bet
- Fair odds payout: `bet_amount x num_outcomes`, capped by pool
- Nullifier-based double-claim prevention

**Use case:** A whale bets 100 BTC on a prediction market. On a public chain, this moves the odds and signals conviction to every other trader. On Lisan, the blockchain shows "someone placed a bet" — nothing more.

### Private Governance Voting

Cast votes that stay hidden until the tally phase.

- Create proposals with custom options and configurable deadlines
- Vote commitments + nullifier hashes enforce one vote per proposal on-chain
- During voting, all choices are hidden — no signaling, no social pressure
- At tally, all votes are revealed in batch and the winner is computed automatically

**Use case:** A DAO votes on treasury allocation. On a public chain, early voters influence later voters. On Lisan, everyone votes independently, and results appear all at once.

### Instant Private Swaps

Swap BTC ↔ STRK on a constant-product AMM routed through the shielded pool. No waiting, no MEV.

- Real-time pool reserves and live swap quotes via `get_amount_out()`
- Liquidity provision for LPs
- Instant execution via relayers — no wallet-to-swap link on-chain

### Any-ERC20 Transfers & Instant Withdrawals

Deposit any ERC20 token on Starknet. Transfer between shielded balances. Withdraw instantly to any fresh address — completely unlinkable to your deposit.

- **Any ERC20 supported** — BTC, STRK, USDC, or any token on Starknet
- P2P shielded transfers (zero on-chain link between sender and receiver)
- Instant two-phase withdrawal: prepare (verify proof) → claim (send to recipient)

### Familiar Wallet UX

No new interface to learn. Connect ArgentX or Braavos — the same wallets you already use on Starknet. Lisan adds privacy to the DeFi experience you already know, with the same tokens you already hold.

### General Private Execution

Call **any Starknet contract** from your shielded balance via `private_execute`. The target contract sees a call from the ShieldedPool, not from you. This means Lisan works with protocols that don't even know Lisan exists.

---

## Architecture

```
You (Browser)
  │  Generate Groth16 proof locally via snarkjs
  │  Your secrets never leave the browser
  ▼
Relayer Network
  │  Receives proof, submits on-chain
  │  Earns 0.5% fee — decentralized, no single point of failure
  ▼
ShieldedPool (Cairo)
  │  Verifies proof on-chain via Garaga
  │  Checks nullifier (no double-spend)
  │  Updates Merkle tree
  │  Forwards call to target contract
  ▼
Target Contract (AMM / PredictionMarket / Voting / Any)
     Executes your action — has no idea who initiated it
```

**Privacy primitives:**
- **Poseidon commitments** — `hash(secret, value, nullifier_secret)` hides balances and choices
- **Nullifiers** — one-time tokens that prevent double-spending
- **Merkle tree** — proves your commitment exists without revealing which one
- **Groth16 proofs** — generated client-side, verified on-chain via Garaga
- **Relayers** — decouple your wallet from the on-chain transaction

---

## What We Built

### Smart Contracts (Cairo 2.0)

| Contract | Address (Starknet Sepolia) | What it does |
|---|---|---|
| ShieldedPool | `0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2` | Core privacy pool — deposit, withdraw, transfer, private_execute |
| ShieldedAMM | `0x02470e8ce4fc20725d80ee8b605d48c676be5a5513d6fde6609d53980b9268a1` | Constant-product DEX (BTC ↔ STRK) |
| PredictionMarket | `0x04de34008dc1945133c984140578059c05aedc8201da9ccfaf0f035814e3e559` | Create markets, place hidden bets, oracle resolution, ZK claim |
| PrivateVoting | `0x05670a0067833e25f39d0baec27ea0ce1dfb662126b469d28a4d768252f6b2b1` | Proposals, hidden votes, batch tally |
| RelayerRegistry | `0x012a228eab2513f1f9a0ba5d337d67749afe995cc73fc6849717ea37dd7e8e04` | Relayer staking, fee management, slashing |
| RelayerCoordinator | `0x06ca449638232ced7caf36d44793271f35750deb90490d14def66cb9d2eb10ca` | Relayer selection (round-robin / fee-based) |
| MockBTC | `0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f` | Test Bitcoin token |
| MockSTRK | `0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f` | Test Starknet token |
| MockPragmaOracle | `0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba` | Oracle for prediction market resolution |

### Frontend (Next.js 16 + React 19 + TypeScript + TailwindCSS)

- **Landing page** — hero, feature blocks, how-it-works walkthrough
- **Prediction markets** — browse markets, place bets, claim winnings, oracle admin panel
- **Voting** — create proposals, cast private votes, tally results
- **Swap** — BTC ↔ STRK with pool reserves chart and live quotes
- **Deposit / Withdraw / Transfer** — full shielded pool interaction
- **Dashboard** — portfolio overview
- **Relayer dashboard** — relayer performance and earnings
- **Client-side ZK proof generation** — snarkjs + circomlibjs in browser

### Tests (Starknet Foundry)

- `test_prediction_market.cairo` — market creation, betting, resolution, claim
- `test_private_voting.cairo` — proposal creation, voting, tally
- `test_shielded_amm.cairo` — swaps, liquidity
- `test_deposit.cairo`, `test_withdraw.cairo`, `test_transfer.cairo`
- `test_integration.cairo` — full deposit → action → withdraw flows

---

## Lisan vs Tornado Cash

| | Tornado Cash | Lisan |
|---|---|---|
| Pool structure | Isolated per amount (0.1, 1, 10 ETH) | Unified — all amounts, all tokens |
| Anonymity set | Small (per pool) | Large (entire platform) |
| What you can do | Deposit → Withdraw | Deposit → Instant Swap → Bet → Vote → Withdraw |
| ERC20 support | Few fixed pools | Any ERC20 token on Starknet |
| UX | Custom interface | ArgentX / Braavos — wallets you already use |
| Prediction markets | No | Yes — hidden positions, ZK claims |
| Private voting | No | Yes — secret until tally |
| Cross-contract calls | No | Yes (`private_execute` to any contract) |
| Relayers | Centralized (shut down 2022) | Decentralized with staking + slashing |
| Proof verification | Offchain | On-chain via Garaga |
| Cost | Ethereum L1 gas | Starknet L2 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Cairo 2.0 (Starknet) |
| ZK Verification | Groth16 via Garaga |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS |
| Proof Generation | snarkjs + circomlibjs (client-side) |
| Wallet | starknet-react, starknetkit (ArgentX, Braavos) |
| Oracle | Pragma (via MockPragmaOracle for testnet) |
| Testing | Starknet Foundry (snforge) |

---

## Target Tracks

### Bitcoin Track
Lisan makes BTC a first-class DeFi asset on Starknet. Users deposit BTC, then swap, bet on prediction markets, vote in DAOs, and withdraw — all privately. This preserves Bitcoin's ethos of privacy and censorship resistance while unlocking DeFi composability.

### Privacy Track
Lisan is privacy infrastructure for the entire Starknet ecosystem. It uses Garaga for on-chain ZK verification, supports any ERC20, and works with any contract via `private_execute`. Decentralized relayers ensure censorship resistance.

---

## Team

**Solo builder** — full-stack blockchain developer. Cairo, Rust, TypeScript, ZK circuits.

Previous hackathon results: Avalanche P1 (privacy infrastructure), CELO P3 (L3 blockchain), ETH Global 1inch track prize.

---

## Roadmap

**Now:** BTC + STRK support, prediction markets, voting, AMM swaps — all deployed on Sepolia.

**Next:** Multi-asset expansion (USDC, ETH), integration with live Starknet AMMs (Ekubo, JediSwap), mobile wallet support.

**Later:** Security audit, mainnet deployment, cross-chain privacy (Bitcoin L1 ↔ Starknet L2).

---

*Do anything on Starknet. No one knows it's you.*

Built for [RE{DEFINE} Hackathon](https://redefine.starknet.io) 2026.
