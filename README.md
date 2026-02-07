# Lisan 🔒

**Private Bitcoin DeFi on Starknet**
*Do anything onchain. No one knows it's you.*

[![Starknet](https://img.shields.io/badge/Starknet-Cairo-orange)](https://starknet.io)
[![Privacy](https://img.shields.io/badge/Privacy-ZK--SNARK-blue)](https://www.cairo-lang.org/)
[![RE{DEFINE}](https://img.shields.io/badge/Hackathon-RE%7BDEFINE%7D-purple)](https://redefine.starknet.io)

---

## 🎯 The Problem

In public blockchains, **every action is visible**:
- Whales get front-run when placing large orders
- Your voting preferences are public
- Prediction market positions leak your alpha
- DeFi strategies are copied the moment you execute

**Privacy should be a feature, not a vulnerability.**

---

## 💡 What is Lisan?

Lisan is a **privacy layer for Starknet DeFi** that lets you interact with ANY contract (swaps, predictions, votes, lending) from a **shielded balance** — without revealing your identity.

Think **Tornado Cash meets Universal DeFi Router** — but instead of isolated pools, you get:
- ✅ **One unified shielded pool** for all assets (BTC, ETH, USDC, any ERC20)
- ✅ **Cross-contract composability** — swap, bet, vote, lend from the same pool
- ✅ **Decentralized relayer network** — no centralized sequencer
- ✅ **Garaga-powered ZK verification** — on-chain proof verification at scale

---

## 🔥 Key Features

### 1. **Shielded Multi-Asset Pool**
Deposit BTC, ETH, USDC (or any ERC20) into a unified Merkle tree. Withdraw to any address, anytime.

```cairo
// Deposit any token privately
shielded_pool.deposit(token_address, amount, commitment)

// Withdraw to any address
shielded_pool.withdraw(nullifier, recipient, amount, proof)
```

### 2. **Private Contract Calls (The Magic)**
Interact with **any Starknet contract** from your shielded balance:

```cairo
// Swap on AMMs
shielded_pool.private_call(
    target: AMM_ADDRESS,
    calldata: [swap_eth_to_usdc, 5_ETH]
)

// Bet on prediction markets
shielded_pool.private_call(
    target: PREDICTION_MARKET,
    calldata: [place_bet, yes, 10_USDC]
)

// Vote on governance (whale votes stay private)
shielded_pool.private_call(
    target: DAO_CONTRACT,
    calldata: [vote, proposal_42, against]
)
```

**The target contract never sees WHO called it** — only that the call came from the shielded pool.

### 3. **Decentralized Relayer Network**
No single point of failure or censorship:
- Users generate ZK proofs **locally** (client-side)
- Relayers compete to submit proofs onchain
- Economic incentives ensure liveness (fees + slashing)
- Privacy-preserving reputation via Merkle commitments

### 4. **Garaga ZK Verification**
On-chain Groth16 proof verification using Garaga (Starknet's ZK verification library):
- Verifies Merkle inclusion proofs
- Prevents double-spending via nullifier checks
- Validates signatures without revealing the signer

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER (Browser)                        │
│  • Generates ZK proof locally (Merkle path + nullifier)      │
│  • Signs withdrawal/call with EdDSA                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   RELAYER NETWORK (Offchain)                 │
│  • Receives encrypted proof from user                        │
│  • Submits to ShieldedPool contract                          │
│  • Earns fees (0.1% of tx value)                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              SHIELDED POOL (Cairo Contract)                  │
│  • Verifies Groth16 proof via Garaga                         │
│  • Checks nullifier hasn't been used                         │
│  • Updates Merkle tree (new commitment)                      │
│  • Forwards call to target contract                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               TARGET CONTRACT (AMM, Market, DAO)             │
│  • Receives call from ShieldedPool                           │
│  • Executes swap/bet/vote                                    │
│  • Returns result to ShieldedPool                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) (Cairo package manager)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) (Testing)
- Node.js 18+ (Frontend)

### 1. Clone & Build

```bash
git clone https://github.com/yourusername/lisan.git
cd lisan

# Build Cairo contracts
scarb build

# Run tests
snforge test
```

### 2. Deploy Contracts (Starknet Sepolia)

```bash
# Deploy ShieldedPool
sncast deploy --contract ShieldedPool

# Deploy Relayer Registry
sncast deploy --contract RelayerRegistry

# Deploy Mock tokens (for testing)
sncast deploy --contract MockBTC
```

### 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Make Your First Private Transaction

```bash
# 1. Deposit 1 BTC
curl -X POST http://localhost:3000/api/deposit \
  -d '{"token": "BTC", "amount": "1000000000"}'

# 2. Generate proof locally (happens in browser)
# 3. Submit via relayer
# 4. Done! Your BTC is now shielded ✅
```

---

## 📁 Repository Structure

```
lisan/
├── contracts/           # Cairo smart contracts
│   ├── ShieldedPool.cairo       # Main privacy pool
│   ├── RelayerRegistry.cairo    # Relayer management
│   ├── ProofVerifier.cairo      # Garaga ZK verification
│   └── MockERC20.cairo          # Test tokens
├── frontend/            # Next.js web app
│   ├── components/      # UI components
│   ├── lib/             # ZK proof generation
│   └── pages/           # App routes
├── circuits/            # ZK circuit definitions (if any)
├── relayer/             # Offchain relayer service
└── tests/               # Smart contract tests
```

---

## 🎮 Live Demo

**[Try Lisan →](https://lisan-demo.vercel.app)**

Demo credentials:
- Pre-loaded testnet BTC
- Interact with mock AMM, prediction market, DAO
- See how privacy works in real-time

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Cairo 2.0 (Starknet) |
| ZK Proofs | Groth16 via Garaga |
| Frontend | Next.js 14 + TypeScript |
| Proof Generation | snarkjs (client-side) |
| Relayer Network | Rust + libp2p |
| Testing | Starknet Foundry |

---

## 🏆 Why Lisan Wins

### For Users
- **True privacy** — your strategy stays yours
- **Universal compatibility** — works with ANY Starknet contract
- **No new interface** — use familiar DeFi apps, just add privacy

### For Starknet
- **Privacy narrative** — "Bitcoin's privacy, Starknet's scalability"
- **Cross-contract composability** — not just isolated pools
- **Decentralized infrastructure** — no reliance on centralized relayers

### For Judges
- **Novel architecture** — unified pool beats Tornado's fragmentation
- **Real-world use case** — whale protection, private voting, frontrun prevention
- **Technical depth** — Garaga ZK verification, Merkle proofs, economic relayer game theory
- **Bitcoin track fit** — makes BTC a DeFi power user asset on Starknet

---

## 🧪 Testing

```bash
# Run all tests
snforge test

# Test specific module
snforge test test_deposit
snforge test test_private_call
snforge test test_relayer_slashing

# Coverage report
snforge coverage
```

---

## 🚧 Roadmap

- [x] **Phase 1:** ShieldedPool contract with deposit/withdraw
- [x] **Phase 2:** Private contract calls (`private_call`)
- [x] **Phase 3:** Relayer registry + economic incentives
- [x] **Phase 4:** Garaga proof verification integration
- [ ] **Phase 5:** Multi-asset support (ETH, USDC, STRK)
- [ ] **Phase 6:** Frontend with proof generation
- [ ] **Phase 7:** Mainnet deployment + audit

---

## 🤝 Contributing

We welcome contributions! Areas we need help:

- **Circuit optimization** — faster proof generation
- **Relayer clients** — more implementations (Go, Python)
- **Frontend UX** — making privacy intuitive
- **Audit reports** — security reviews

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📜 License

MIT License - see [LICENSE](./LICENSE)

---

## 🔗 Links

- **Demo:** [lisan-demo.vercel.app](https://lisan-demo.vercel.app)
- **Docs:** [docs.lisan.xyz](https://docs.lisan.xyz)
- **Twitter:** [@LisanPrivacy](https://twitter.com/LisanPrivacy)
- **Hackathon Submission:** [RE{DEFINE} Starknet](https://redefine.starknet.io)

---

## 📞 Contact

Built by [@arkoroy](https://github.com/arkoroy) for RE{DEFINE} Hackathon.

Questions? Open an issue or DM on Twitter.

---

**Lisan** — *Privacy for the DeFi masses* 🔒✨
