# Lisan — Video Script (RE{DEFINE} Hackathon)

**Target:** Hackathon judges (technical + business backgrounds)
**Tone:** Urgent, confident, demo-heavy, fear-then-solution
**Format:** Screen recording + voiceover + mempool visuals
**Length:** 3:00 minutes (strict)
**Goal:** Make judges remember "the Bitcoin DeFi one" and "the composability one"

---

## ACT 1: THE HEIST (0:00-0:25) 🎯 HOOK WITH FEAR

**[VISUAL: Live Ethereum/Starknet mempool visualization - pending transactions scrolling, amounts visible]**

**Narrator (urgent tone):**
> "This is the dark forest. Every DeFi swap is visible before it executes. Front-running bots watch the mempool. They see your trade. They copy it. They profit."

**[VISUAL: Animation showing bot front-running a swap - user loses $1,200]**

> "MEV bots extracted $1.38 billion in 2024 alone. Your alpha is their profit."

**[VISUAL: Prediction market bet - large bet on "Trump wins" - whale wallets immediately copy the position]**

> "Prediction markets? Your bet is public. Whales follow your position. Your edge evaporates the moment you place it."

**[VISUAL: Screen glitch transition to black, then Lisan logo appears]**

> "What if every transaction was invisible until it's too late to front-run?"

**[TEXT OVERLAY: "Lisan"]**

---

## ACT 2: THE PROMISE (0:25-0:45) 🎯 PLATFORM POSITIONING

**[VISUAL: Lisan architecture diagram - animated, clean, modern]**

**Narrator (confident, authoritative):**
> "Bitcoin on Starknet can transfer. That's it. Lisan makes Bitcoin productive — private swaps, private predictions, private votes, private execution of any contract. One shielded pool. All instant."

**[VISUAL: Features appear as animated checkmarks]**

✓ **Private Transfers**
✓ **Private Swaps** (AMM, zero front-running)
✓ **Private Predictions** (hidden bets, oracle-resolved)
✓ **Private Voting** (secret ballot DAOs)
✓ **Private Execute** (call ANY contract privately)

**[TEXT OVERLAY: "This isn't Tornado Cash. This is infrastructure."]**

---

## ACT 3: DEMO — DEPOSIT & TRANSFER (0:45-1:10) 🎯 CORE PRIVACY PRIMITIVE

**[VISUAL: Lisan app, wallet connected, Deposit page]**

**Narrator:**
> "Watch. I deposit 10 Bitcoin into the shielded pool."

**[ACTION: Select mBTC token, enter 10, click Deposit]**
**[VISUAL: Transaction confirmation, then Merkle tree visualization - new leaf added to tree with 1,247 commitments]**

> "My balance is now hidden in a Merkle tree with over 1,200 other commitments. No one knows how much I have."

**[ACTION: Navigate to Transfer page, send 3 BTC to another address]**
**[VISUAL: Proof generating (sped up 2x with overlay "Generating ZK proof..."), relayer selected, tx confirmed]**

> "I send
 spent, no details]**

**[TEXT OVERLAY on explorer: "On-chain: Just a nullifier. That's it."]**

---

## ACT 4: DEMO — PRIVATE SWAP (1:10-1:35) 🎯 ANTI-MEV VALUE PROP

**[VISUAL: Navigate to Swap page, AMM interface showing BTC/STRK pool]**

**Narrator:**
> "Now I want to swap 2 Bitcoin for STRK. Normally, MEV bots would front-run this. Watch what happens instead."

**[ACTION: Enter 2 BTC, show live quote]**
**[VISUAL: Quote shows "You receive: 4,892 STRK" based on pool reserves]**

> "I generate a proof locally. My secrets never leave the browser. I submit through a decentralized relayer."

**[ACTION: Click Swap, proof generates (sped up), relayer submits, tx confirmed]**

**[VISUAL: Split screen - left shows user's wallet (no public tx), right shows Voyager explorer]**

> "On-chain, the ShieldedPool swapped with the AMM. But there's no trace back to my wallet. The AMM thinks the POOL is trading. It has no idea I'm behind it."

**[TEXT OVERLAY: "Result: Zero front-running. Zero MEV. Zero surveillance."]**

---

## ACT 5: DEMO — PRIVATE EXECUTE (1:35-2:05) 🎯 KILLER DIFFERENTIATOR

**[VISUAL: Navigate to Private Execute page - shows input fields for contract address + calldata]**

**Narrator (excited, emphasis on "ANY"):**
> "Here's the killer feature. Private Execute. I can call ANY Starknet contract using my shielded balance."

**[ACTION: Enter external NFT contract address, mint function calldata]**

> "I want to mint an NFT. I paste the contract address. The pool will call it on my behalf."

**[ACTION: Generate proof, submit, tx confirmed]**
**[VISUAL: NFT appears in a wallet, but explorer shows pool → NFT contract call]**

> "The NFT contract thinks the POOL minted it. My wallet is never revealed."

**[VISUAL: Text list appears showing other use cases]**
- Lend on Aave (private positions)
- Vote in any DAO (secret ballots)
- Play blockchain games (anonymous players)
- Supply liquidity (hidden LP positions)

**[TEXT OVERLAY: "This works with ANY contract. ANY protocol. This is composability."]**

---

## ACT 6: THE ROADMAP BAIT (2:05-2:30) 🎯 AMBITION + INNOVATION THEFT

**[VISUAL: Feature checklist - split into "Live Today" and "Coming Soon"]**

**Narrator:**
> "Lisan is deployed on Starknet Sepolia today. But we're not stopping."

**[VISUAL: Left column (green checkmarks)]**

✅ Multi-asset shielded pool (BTC, STRK, any ERC20)
✅ Private transfers, swaps, predictions, voting
✅ Private Execute (composability layer)
✅ Decentralized relayer network
✅ 75+ passing tests, live frontend, validated by Starknet leads

**[VISUAL: Right column (yellow clock icons)]**

⏳ **Privacy Scoring** — Quantified anonymity (0-100 score)
⏳ **Halftime Trading** — Adjust prediction bets mid-event
⏳ **AI Agent Escrow** — Autonomous private payments for the agentic economy

**[TEXT OVERLAY: "We're building the privacy layer Starknet needs. Infrastructure, not apps."]**

---

## ACT 7: THE CALL TO ACTION (2:30-3:00) 🎯 PROOF + SOCIAL PROOF

**[VISUAL: Contract addresses appear on screen with Voyager links]**

**Narrator:**
> "This isn't a prototype. Lisan is deployed. Tested. Working. Right now."

**[VISUAL: Contract list with links]**
- **ShieldedPool:** `0x0537...2cba` [Voyager ↗]
- **ShieldedAMM:** `0x0247...68a1` [Voyager ↗]
- **PredictionMarket:** `0x04de...e559` [Voyager ↗]

**[VISUAL: Validator quotes appear as testimonials]**

**Adrien (Bitcoin Lead):** "Worth building and needed in Starknet."

**Teddy (Privacy Lead):** "Unified pool correct. Bullish on prediction markets."

**Richard (Foundation):** "Relayers really really good idea. Extra point."

**[VISUAL: GitHub repo, live demo link, documentation]**

**Narrator (confident, final pitch):**
> "Try it. Break it. Build on it. Lisan is the privacy primitive for Starknet's DeFi future."

**[VISUAL: Fade to black, then Lisan logo with tagline]**

**[TEXT OVERLAY: "Lisan: Every transaction. Always private. Forever unstoppable."]**

**[END CARD]**
- GitHub: github.com/[repo]
- Live Demo: lisan.app (or Sepolia link)
- RE{DEFINE} Hackathon 2026
- Bitcoin Track | Open Track

---

## PRODUCTION NOTES

### Pre-Recording Checklist
- [ ] Pre-populate test data (deposit done, tokens in pool)
- [ ] Clear browser cache, hide bookmarks bar
- [ ] Set up Voyager explorer tabs (contracts ready to show)
- [ ] Test all demo flows (no surprises during recording)
- [ ] Prepare mempool visualization (can use Etherscan live or recording)

### Recording Setup
- **Screen:** 1920x1080, 60fps (OBS Studio)
- **Browser:** Dark mode, maximized, clean UI
- **Audio:** External mic (not laptop), room echo minimized
- **Backup:** Record 2-3 takes, pick best one

### Visual Effects Needed
1. **Mempool visualization (0:00-0:15):** Use Etherscan live pending txs or stock footage
2. **Front-running animation (0:10):** Simple graphic showing bot copying user's trade
3. **Merkle tree visualization (0:55):** Animated tree growing when deposit happens
4. **Split screen (1:25):** User wallet + Explorer side-by-side
5. **Text overlays:** Key phrases appear at emotional beats

### Editing Checklist
- [ ] Speed up proof generation to 2x (add "Generating ZK proof..." overlay)
- [ ] Add captions for technical terms (first mention only):
  - Merkle tree
  - Nullifier
  - ZK proof
  - Relayer
  - Garaga
- [ ] Background music: Cyberpunk/electronic, subtle, royalty-free
- [ ] Color grade: Slightly blue-tinted (tech/privacy vibe)
- [ ] Export: 1080p H.264, <150MB for DoraHacks upload

### Tone Guide for Voice Actor (or Self-Recording)
- **Act 1 (0:00-0:25):** Urgent, slightly ominous. "This is a threat."
- **Act 2 (0:25-0:45):** Confident, authoritative. "We solved it."
- **Act 3-5 (0:45-2:05):** Clear, demo-focused. "Watch this."
- **Act 6 (2:05-2:30):** Ambitious, forward-looking. "This is just the start."
- **Act 7 (2:30-3:00):** Proud, inviting. "Join us."

### Backup: 2-Minute Cut (If Needed)
If DoraHacks requires <3min:
- **Cut Act 6 entirely** (roadmap bait)
- **Shorten Act 3** (just show deposit, skip transfer)
- **Shorten Act 5** (just show Private Execute, skip use case list)
- Final length: ~2:15

### 30-Second Teaser (For Twitter/Discord)
- 0:00-0:15: Act 1 (The Heist) - hook with fear
- 0:15-0:25: Act 4 (Private Swap) - sped up to 10 sec
- 0:25-0:30: Act 7 ending (logo + tagline)

---

## KEY MESSAGES (Must Land)

1. **"Privacy layer, not privacy app"** — Lisan is infrastructure
2. **"Any token, any contract"** — Composability is the differentiator
3. **"Live today"** — Not a prototype, not a roadmap, deployed now
4. **"Zero front-running, zero MEV, zero surveillance"** — Tangible benefits
5. **"This is the privacy primitive Starknet needs"** — Chain narrative fit

---

## JUDGE PSYCHOLOGY

**What judges are thinking:**

| Timestamp | Judge's Question | How We Answer It |
|-----------|------------------|------------------|
| 0:10 | "Is this just another mixer?" | "No - you can DO things: swap, bet, vote, call any contract" |
| 0:45 | "Does this actually work?" | "Yes - here are the demos, here are the contract addresses" |
| 1:35 | "What's novel here?" | "Private Execute - first privacy layer with composability" |
| 2:30 | "Is this production-ready?" | "Deployed, tested, validated by 3 Starknet leads" |
| 2:55 | "Why should this win?" | "Infrastructure play - every DeFi app on Starknet could use this" |

---

## COMPETITIVE DIFFERENTIATION (Implied, Not Stated)

While narrating, the video visually beats competitors without naming them:

- **vs Rift:** They do one thing (Runes trading). We do everything (platform).
- **vs ShadowNet:** They have "foundations". We have working code.
- **vs StealthSwap:** They admitted "not generating proofs yet". We show proofs on-chain.
- **vs ZKScore:** They have one feature (predictions). We have five + composability.
- **vs zkCAREL:** They have a roadmap. We have contracts.

**Judges will see the difference without us being explicitly competitive.**

---

## SUCCESS METRICS

**Video succeeds if judges remember:**
1. "Lisan = privacy layer" (platform positioning)
2. "Private Execute = call any contract" (unique differentiator)
3. "Already deployed" (production-ready)

**Video fails if judges think:**
1. "Just another Tornado Cash fork"
2. "Only works for one use case"
3. "Vaporware / not finished"

**Every second of this script is designed to prevent the failure cases.**
