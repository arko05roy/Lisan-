# Lisan — Dorahacks Submission

## 📋 Project Title
**Lisan: Private Bitcoin DeFi Platform on Starknet**

---

## 🎯 One-Line Description
Privacy layer for Starknet that lets users interact with ANY DeFi contract (swaps, predictions, voting) from shielded balances using zero-knowledge proofs and decentralized relayers.

---

## 📝 Project Description

### The Problem

Public blockchains expose every transaction:
- **Whales get front-run** when placing large orders (avg. $200k loss per trade)
- **Prediction market positions leak alpha** — your bets signal your analysis to competitors
- **DAO votes are public** — making private governance impossible
- **DeFi strategies are copied** the moment they're executed

Privacy on Ethereum either means:
1. **Isolated pools** (Tornado Cash) — limited anonymity sets, no composability
2. **Centralized mixers** — trust dependencies, regulatory risk
3. **Nothing** — most DeFi has zero privacy

**DeFi users need privacy without sacrificing composability or decentralization.**

---

### Our Solution: Lisan

Lisan is a **privacy layer for Starknet DeFi** that provides:

#### 1️⃣ **Unified Shielded Pool**
- Deposit BTC, ETH, USDC (any ERC20) into a single Merkle tree
- One anonymity set for all assets and all actions
- Larger anonymity set = harder to link deposits to withdrawals

#### 2️⃣ **Private Contract Calls**
The innovation: Users can call **ANY Starknet contract** from their shielded balance:

```cairo
// Swap on an AMM
shielded_pool.private_call(
    target: AMM_CONTRACT,
    calldata: [swap, 5_BTC, USDC]
)

// Bet on prediction market
shielded_pool.private_call(
    target: PREDICTION_MARKET,
    calldata: [bet, proposal_42, yes, 10_USDC]
)

// Vote on DAO governance
shielded_pool.private_call(
    target: DAO_CONTRACT,
    calldata: [vote, proposal_7, against]
)
```

**The target contract never sees WHO made the call** — only that a valid proof was verified.

#### 3️⃣ **Decentralized Relayer Network**
- Users generate Groth16 proofs **locally** (client-side, no server sees secrets)
- Relayers compete to submit proofs on-chain
- Economic incentives: Fees (0.1% of tx value) + slashing for misbehavior
- No centralized relayer dependency (unlike Tornado Cash)

#### 4️⃣ **Garaga ZK Verification**
- On-chain Groth16 proof verification using Garaga (Starknet's ZK library)
- Verifies Merkle inclusion + nullifier uniqueness + signature validity
- Makes privacy verification **native to Starknet** — no offchain trust

---

### Why This Matters

#### For Users:
- **True privacy** — front-runners can't see your strategy
- **Universal compatibility** — works with ANY Starknet contract (not just specific protocols)
- **No new UX** — use familiar DeFi apps, just add privacy layer

#### For Starknet:
- **Privacy narrative** — "Bitcoin's privacy, Starknet's scalability"
- **Cross-contract composability** — not just isolated pools
- **Infrastructure-level value** — benefits entire ecosystem

#### For Bitcoin:
- **Makes BTC a DeFi power user** — use Bitcoin for swaps, bets, votes without leaving Starknet
- **Preserves Bitcoin ethos** — privacy + decentralization
- **Bridges Bitcoin → DeFi** — without compromising on principles

---

### Technical Architecture

```
USER (Browser)
  ↓ [Generates ZK proof locally]
RELAYER NETWORK (Offchain)
  ↓ [Submits proof to Starknet]
SHIELDED POOL (Cairo Contract)
  ↓ [Verifies proof via Garaga, forwards call]
TARGET CONTRACT (AMM/Market/DAO)
  ↓ [Executes action, returns result]
```

**Key Components:**

1. **ShieldedPool.cairo** — Merkle tree storage, proof verification, call forwarding
2. **RelayerRegistry.cairo** — Relayer registration, fee management, slashing logic
3. **ProofVerifier.cairo** — Garaga integration for Groth16 verification
4. **Frontend (Next.js)** — Proof generation (snarkjs), wallet integration, relayer discovery
5. **Relayer Service (Rust)** — Listens for proof submissions, competes on gas fees

---

### Innovation Beyond Tornado Cash

| Feature | Tornado Cash | Lisan |
|---------|--------------|-------|
| **Pool Structure** | Isolated (0.1 ETH pool, 1 ETH pool, etc.) | Unified (all amounts, all tokens) |
| **Anonymity Set** | Small (per-pool) | Large (entire platform) |
| **Composability** | Deposit → Wait → Withdraw | Deposit → Swap/Bet/Vote → Withdraw |
| **Relayers** | Centralized (shut down by authorities) | Decentralized (economic incentives) |
| **Chain** | Ethereum (expensive proofs) | Starknet (cheap, fast, native ZK) |
| **Verification** | Offchain vulnerable to sequencer censorship | Onchain via Garaga |

**Lisan isn't a clone. It's an evolution.**

---

## 🏆 What We Built During the Hackathon

### Smart Contracts (Cairo)
- ✅ **ShieldedPool contract** — Merkle tree, deposit/withdraw, private calls
- ✅ **RelayerRegistry contract** — Relayer management, staking, slashing
- ✅ **ProofVerifier contract** — Garaga integration (Groth16 verification)
- ✅ **MockERC20 tokens** — BTC, ETH, USDC for testing
- ✅ **Deployed to Starknet Sepolia testnet**

### Frontend (Next.js + TypeScript)
- ✅ **Deposit page** — Deposit any ERC20 into shielded pool
- ✅ **Withdraw page** — Withdraw to any address with ZK proof
- ✅ **Swap page** — Private swaps via AMM integration
- ✅ **Prediction markets page** — Private betting on outcomes
- ✅ **Client-side proof generation** — Using snarkjs in browser
- ✅ **Relayer discovery UI** — Select relayer based on fees/latency

### Relayer Service (Rust)
- ✅ **Basic relayer node** — Listens for proof submissions
- ✅ **Fee estimation** — Calculates gas costs + profit margin
- ✅ **Proof submission** — Submits to ShieldedPool contract
- ⏳ **P2P networking** — (Planned: libp2p for decentralized relay network)

### Testing & Documentation
- ✅ **Unit tests** — Starknet Foundry (snforge)
- ✅ **Integration tests** — Full deposit → call → withdraw flow
- ✅ **Landing page** — Explaining Lisan to non-technical users
- ✅ **Technical docs** — Architecture, contract APIs, ZK circuits

---

## 🎯 Target Tracks

### Primary Track: **Bitcoin Track**
**Why Lisan fits:**
- Makes Bitcoin a **first-class DeFi asset** on Starknet
- Users deposit BTC, interact with DeFi protocols, withdraw BTC — all privately
- Preserves **Bitcoin ethos**: privacy + decentralization + censorship resistance
- Solves Bitcoin DeFi UX problem: "How do I use BTC for advanced DeFi without losing privacy?"

**Validation from office hours:**
- **Adrien (Bitcoin Lead):** "Worth building and needed in Starknet" + "dual-track approved"
- **Teddy (Privacy Lead):** Unified pool architecture validated, "privacy must benefit protocol"

### Secondary Track: **Privacy Track**
**Why Lisan fits:**
- Core innovation is **privacy infrastructure** for Starknet
- Uses Garaga (Starknet's native ZK library) for proof verification
- Enables privacy for **entire DeFi ecosystem** (not just one protocol)
- Decentralized relayers prevent censorship

---

## 🛠️ Tech Stack

- **Smart Contracts:** Cairo 2.0 (Starknet)
- **ZK Proofs:** Groth16 via Garaga
- **Frontend:** Next.js 14, TypeScript, TailwindCSS
- **Proof Generation:** snarkjs (client-side in browser)
- **Relayer Network:** Rust, libp2p (planned)
- **Testing:** Starknet Foundry (snforge)
- **Deployment:** Starknet Sepolia testnet

---

## 🔗 Links

- **GitHub Repository:** [github.com/yourusername/lisan](https://github.com/yourusername/lisan)
- **Live Demo:** [lisan-demo.vercel.app](https://lisan-demo.vercel.app)
- **Video Demo:** [YouTube link — 3min walkthrough]
- **Documentation:** [docs in repo /docs folder]
- **Twitter:** [@LisanPrivacy](https://twitter.com/LisanPrivacy)

---

## 📸 Screenshots

### 1. Landing Page
![Landing Page](./screenshots/landing.png)
*Clear value prop: "Do anything on Starknet. No one knows it's you."*

### 2. Deposit Flow
![Deposit](./screenshots/deposit.png)
*Deposit BTC, ETH, or any ERC20 into shielded pool*

### 3. Private Swap
![Swap](./screenshots/swap.png)
*Swap tokens from shielded balance via AMM integration*

### 4. Prediction Market Betting
![Betting](./screenshots/betting.png)
*Place bets on outcomes without revealing your position*

### 5. Proof Verification (Blockchain)
![Explorer](./screenshots/explorer.png)
*On-chain proof verification via Garaga — no offchain trust*

---

## 🎥 Demo Video Script Highlights

**0:00-0:20** — The problem: "Every transaction is public. Whales lose $200k to front-running."

**0:20-0:50** — Show Etherscan transaction revealing amounts, addresses, timing → MEV bots front-running

**0:50-1:30** — Explain Lisan architecture: Shielded pool → ZK proof → Relayer → Garaga verification

**1:30-3:30** — Live demo:
- Deposit 5 BTC
- Swap 2 BTC → USDC (privately)
- Bet 1 BTC on prediction market (no one sees position)
- Withdraw 1 BTC to fresh address (unlinkable)

**3:30-4:15** — Why Lisan > Tornado Cash:
- Unified pool (larger anonymity set)
- Cross-contract composability
- Decentralized relayers
- Starknet native (cheap + fast)

**4:15-5:00** — Roadmap: Multi-asset support → Mobile wallets → Mainnet audit → Cross-chain privacy

---

## 👤 Team

**Solo Builder:** [@arkoroy](https://github.com/arkoroy)

- **Background:** Full-stack blockchain developer, 5-10 hackathons per year
- **Skills:** Cairo, Rust, TypeScript, ZK circuits, DeFi protocol design
- **Previous wins:** Avalanche P1 (privacy infrastructure), CELO P3 (L3 blockchain), ETH Global (1inch track prize)

**Why solo?**
- Fast iteration speed (no coordination overhead)
- Deep technical focus (privacy + ZK is complex)
- Hackathon experience (proven track record of shipping complex projects in <1 week)

---

## 🚀 What's Next (Post-Hackathon)

### Immediate (Week 1-2)
- [ ] Add ETH, USDC, STRK support (multi-asset)
- [ ] Optimize proof generation speed (sub-5 second proofs)
- [ ] Deploy more relayer nodes (decentralization)

### Short-term (Month 1-3)
- [ ] Mobile wallet integration (ArgentX, Braavos)
- [ ] Integrate with real Starknet AMMs (Ekubo, JediSwap)
- [ ] Add more DeFi protocols (lending, staking)

### Long-term (Q2-Q3 2026)
- [ ] Security audit (CertiK, Trail of Bits)
- [ ] Mainnet launch
- [ ] Cross-chain privacy (Bitcoin L1 ↔ Starknet L2)
- [ ] DAO governance for protocol upgrades

---

## 💡 Why Lisan Will Win

### 1. **Solves Real Problem**
Front-running costs DeFi users **$500M+ annually**. Privacy isn't a nice-to-have — it's a need-to-have.

### 2. **Novel Architecture**
Not just a Tornado Cash clone. Unified pool + cross-contract composability + decentralized relayers = **new privacy paradigm**.

### 3. **Perfect Strategic Fit**
- **Bitcoin track:** Makes BTC a DeFi power user
- **Privacy track:** Enables privacy for entire Starknet ecosystem
- **Starknet narrative:** "ZK-native L2 for private DeFi"

### 4. **Technical Depth + Demo-ability**
- Complex ZK circuits + Garaga verification = judges see technical rigor
- Live demo with deposit/swap/bet/withdraw = judges see it WORKS
- Not just slides — actual working code on testnet

### 5. **Validated by Experts**
- **Adrien (Bitcoin Lead):** "Worth building and needed"
- **Teddy (Privacy Lead):** Unified pool architecture confirmed correct
- **Richard (Foundation):** Relayers = "really really good idea" + "extra point"

### 6. **Clear Roadmap**
Not a hackathon toy. This is **infrastructure** with clear path to mainnet, audits, and real adoption.

---

## 📊 Impact Metrics (If Adopted)

- **Privacy for 100k+ Starknet users** within 6 months of mainnet launch
- **$10M+ in shielded volume** within first year
- **50+ integrated DeFi protocols** (AMMs, markets, DAOs, lending)
- **100+ decentralized relayers** (economic incentives ensure liveness)

Privacy isn't optional. **Lisan makes it accessible.**

---

## 🏁 Final Pitch

> **Lisan is to Starknet what Tornado Cash was supposed to be to Ethereum — but better.**
>
> We fix Tornado's fatal flaws:
> - ❌ Isolated pools → ✅ Unified pool
> - ❌ No composability → ✅ Cross-contract calls
> - ❌ Centralized relayers → ✅ Decentralized network
> - ❌ Ethereum gas costs → ✅ Starknet efficiency
>
> We preserve its strengths:
> - ✅ Zero-knowledge proofs
> - ✅ Non-custodial
> - ✅ Unlinkable deposits/withdrawals
>
> And we add new capabilities:
> - 🆕 Privacy for ANY DeFi protocol
> - 🆕 Makes Bitcoin a DeFi power user
> - 🆕 Starknet-native (Garaga verification)
>
> **Privacy for the DeFi masses. Built on Starknet. Powered by math.**

---

**Lisan** — *Do anything on Starknet. No one knows it's you.* 🔒

---

## 📞 Contact

- **GitHub:** [@arkoroy](https://github.com/arkoroy)
- **Twitter:** [@LisanPrivacy](https://twitter.com/LisanPrivacy)
- **Email:** arko@lisan.xyz (or personal email)
- **Telegram:** @arkoroy (if applicable)

Open to questions, feedback, and collaboration opportunities!

---

## 🙏 Acknowledgments

Special thanks to:
- **Adrien Lacombe** (Bitcoin Lead) — for validating Bitcoin DeFi use case
- **Teddy** (Privacy Lead) — for confirming unified pool architecture
- **Richard** (Foundation) — for relayer network feedback
- **Starknet team** — for building the ZK-native L2 that makes this possible
- **Garaga team** — for on-chain ZK verification tools

Built with ❤️ for RE{DEFINE} Hackathon 2026.
