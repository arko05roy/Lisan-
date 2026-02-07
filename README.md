# Lisan

**Private DeFi on Starknet — swaps, prediction markets, voting, and transfers, all from a shielded balance.**

No one sees what you bet. No one sees how you vote. No one sees what you trade.

---

## About

Lisan is a privacy layer for Starknet. You connect your existing wallet — ArgentX or Braavos — deposit any ERC20 token into a shielded pool, and interact with DeFi privately. Prediction markets, governance voting, instant swaps, transfers, withdrawals to fresh addresses — all without revealing your identity.

Zero-knowledge proofs verify everything client-side. A decentralized relayer network submits your transactions so there's no on-chain link back to your wallet. The UX is familiar — same wallets, same tokens, just private.

Unlike Tornado Cash (isolated pools, deposit-and-withdraw only), Lisan gives you a **unified pool across all tokens and all actions**, with full DeFi composability built in.

---

## Features

### Prediction Markets
Create markets, place hidden bets, claim winnings after resolution. Your position stays secret — no copy-traders, no front-running your alpha.

- Binary (YES/NO) and multi-outcome markets
- Oracle-based resolution (Pragma integration)
- Bet commitments hide your amount and side
- ZK proof required to claim payout — proves you won without revealing your bet

### Private Governance Voting
Cast votes that stay hidden until the tally phase. Whale votes are private. No social pressure, no vote-buying verification.

- Custom proposals with configurable options and deadlines
- Vote commitments + nullifier hashes (one vote per proposal, enforced on-chain)
- Choices revealed only at tally — all at once
- Winning option computed automatically

### Instant Private Swaps
Swap BTC ↔ STRK on a constant-product AMM routed through the shielded pool. No wallet link, no MEV extraction, no waiting.

- Real-time pool reserves and live swap quotes via `get_amount_out()`
- Liquidity provision for LPs
- All swaps submitted via relayers — instant execution, no trace back to your wallet

### Any-ERC20 Transfers & Instant Withdrawals
Deposit any ERC20 token. Move funds between shielded balances. Withdraw to any fresh address instantly — unlinkable to your original deposit.

- **Any ERC20 supported** — BTC, STRK, USDC, or any token on Starknet
- P2P shielded transfers (zero on-chain link between sender and receiver)
- Instant two-phase withdrawal: prepare (verify proof) → claim (send to recipient)

### Familiar Wallet UX
No new interface to learn. Connect ArgentX or Braavos — the wallets you already use on Starknet — and you're ready. Lisan adds privacy to the DeFi experience you already know.

### General Private Execution
Call **any Starknet contract** from your shielded balance via `private_execute`. The target contract sees a call from the ShieldedPool — not from you.

---

## How It Works

```
You (Browser)           →  Generate Groth16 proof locally (snarkjs)
                            Your secrets never leave the browser.

Relayer Network         →  Receives your proof, submits it on-chain.
                            Earns 0.5% fee. No single point of failure.

ShieldedPool (Cairo)    →  Verifies proof via Garaga (on-chain ZK verification).
                            Checks nullifier. Updates Merkle tree.
                            Forwards your call to the target contract.

Target Contract         →  Executes your swap / bet / vote / transfer.
                            Has no idea who you are.
```

**Privacy primitives used:**
- **Poseidon commitments** — hide your balance and choices
- **Nullifiers** — prevent double-spending (one-time use tokens)
- **Merkle tree** — prove your commitment exists without revealing which one
- **Groth16 proofs** — generated client-side, verified on-chain via Garaga
- **Relayers** — break the wallet-to-transaction link

---

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|---|---|
| ShieldedPool | [`0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2`](https://sepolia.starkscan.co/contract/0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2) |
| ShieldedAMM | [`0x02470e8ce4fc20725d80ee8b605d48c676be5a5513d6fde6609d53980b9268a1`](https://sepolia.starkscan.co/contract/0x02470e8ce4fc20725d80ee8b605d48c676be5a5513d6fde6609d53980b9268a1) |
| PredictionMarket | [`0x04de34008dc1945133c984140578059c05aedc8201da9ccfaf0f035814e3e559`](https://sepolia.starkscan.co/contract/0x04de34008dc1945133c984140578059c05aedc8201da9ccfaf0f035814e3e559) |
| PrivateVoting | [`0x05670a0067833e25f39d0baec27ea0ce1dfb662126b469d28a4d768252f6b2b1`](https://sepolia.starkscan.co/contract/0x05670a0067833e25f39d0baec27ea0ce1dfb662126b469d28a4d768252f6b2b1) |
| RelayerRegistry | [`0x012a228eab2513f1f9a0ba5d337d67749afe995cc73fc6849717ea37dd7e8e04`](https://sepolia.starkscan.co/contract/0x012a228eab2513f1f9a0ba5d337d67749afe995cc73fc6849717ea37dd7e8e04) |
| RelayerCoordinator | [`0x06ca449638232ced7caf36d44793271f35750deb90490d14def66cb9d2eb10ca`](https://sepolia.starkscan.co/contract/0x06ca449638232ced7caf36d44793271f35750deb90490d14def66cb9d2eb10ca) |
| MockBTC | [`0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f`](https://sepolia.starkscan.co/contract/0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f) |
| MockSTRK | [`0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f`](https://sepolia.starkscan.co/contract/0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f) |
| MockPragmaOracle | [`0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba`](https://sepolia.starkscan.co/contract/0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Cairo 2.0 (Starknet) |
| ZK Verification | Groth16 via Garaga |
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS |
| Proof Generation | snarkjs + circomlibjs (client-side) |
| Wallet | starknet-react, starknetkit (ArgentX, Braavos) |
| Testing | Starknet Foundry (snforge) |

---

## Project Structure

```
lisan/
├── client/                           # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   └── (app)/
│   │       ├── predict/page.tsx      # Prediction markets
│   │       ├── vote/page.tsx         # Private voting
│   │       ├── swap/page.tsx         # Shielded AMM
│   │       ├── deposit/page.tsx      # Deposit into pool
│   │       ├── withdraw/page.tsx     # Withdraw from pool
│   │       ├── transfer/page.tsx     # P2P transfers
│   │       ├── execute/page.tsx      # Custom contract calls
│   │       └── dashboard/page.tsx    # Portfolio overview
│   └── lib/
│       ├── crypto.ts                 # Commitment generation
│       ├── prover.ts                 # ZK proof generation
│       ├── merkle.ts                 # Merkle tree logic
│       └── relay.ts                  # Relayer API
│
├── lisan_contracts/                  # Cairo smart contracts
│   ├── src/
│   │   ├── shielded_pool.cairo       # Core privacy pool
│   │   ├── shielded_amm.cairo        # Private DEX
│   │   ├── prediction_market.cairo   # Private betting
│   │   ├── private_voting.cairo      # Secret governance
│   │   ├── relayer_registry.cairo    # Relayer staking & fees
│   │   ├── relayer_coordinator.cairo # Relayer selection
│   │   ├── merkle_tree.cairo         # Merkle proofs
│   │   └── commitment.cairo          # Poseidon commitments
│   └── tests/
│       ├── test_prediction_market.cairo
│       ├── test_private_voting.cairo
│       ├── test_shielded_amm.cairo
│       └── test_integration.cairo
│
└── circuits/                         # ZK circuit definitions
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

Open [http://localhost:3000](http://localhost:3000). Connect an ArgentX or Braavos wallet on Sepolia.

---

## Contract API

### PredictionMarket

```cairo
create_market(question_hash, num_outcomes, resolution_time) → market_id
place_bet(market_id, bet_commitment, amount)                → hidden position
resolve(market_id)                                          → queries oracle, sets winner
claim(market_id, proof, bet_commitment, nullifier, recipient) → payout
```

### PrivateVoting

```cairo
create_proposal(description_hash, num_options, end_time) → proposal_id
cast_vote(proposal_id, vote_commitment, nullifier_hash)  → hidden vote
tally(proposal_id, revealed_votes[])                     → results + winner
```

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

---

## Lisan vs Tornado Cash

| | Tornado Cash | Lisan |
|---|---|---|
| Pool structure | Isolated per amount | Unified — all amounts, all tokens |
| Anonymity set | Small (per pool) | Large (entire platform) |
| Actions | Deposit → Withdraw | Deposit → Instant Swap → Bet → Vote → Withdraw |
| Token support | Few fixed pools | Any ERC20 on Starknet |
| Wallet UX | Custom interface | ArgentX / Braavos — wallets you already use |
| Prediction markets | No | Yes |
| Private voting | No | Yes |
| Cross-contract calls | No | Yes (`private_execute`) |
| Relayers | Centralized (shut down) | Decentralized with economic incentives |
| Verification | Offchain | On-chain via Garaga |
| Cost | Ethereum L1 gas | Starknet L2 |

---

## License

MIT

---

Built for [RE{DEFINE} Hackathon](https://redefine.starknet.io) 2026.
