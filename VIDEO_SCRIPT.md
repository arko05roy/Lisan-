# Lisan — Video Script (3-5 minutes)

**Target:** Hackathon judges + Starknet community
**Tone:** Clear, confident, demo-focused
**Format:** Screen recording + voiceover

---

## 🎬 OPENING (0:00 - 0:20)

**[VISUAL: Lisan logo fades in, then split screen showing public blockchain explorer]**

**VOICEOVER:**

> "Every transaction on Ethereum is public. When you swap tokens, bet on prediction markets, or vote in a DAO — everyone sees it.
>
> Front-runners watch your moves. Copycats steal your strategy. Privacy isn't a feature — it's a vulnerability.
>
> **Introducing Lisan** — the privacy layer for Starknet DeFi."

---

## 🔍 THE PROBLEM (0:20 - 0:50)

**[VISUAL: Screen recording showing Etherscan transaction details, highlighting visible amounts, addresses, and timestamps]**

**VOICEOVER:**

> "Let's see the problem. Here's a whale swapping 10 million USDC on Uniswap.
>
> *[Scroll through transaction details]*
>
> - His wallet address? **Public.**
> - The amount he's swapping? **Public.**
> - The exact timestamp? **Public.**
>
> Now watch what happens next.
>
> *[Show follow-on transactions front-running the whale]*
>
> MEV bots front-run his trade. He loses $200,000 to slippage. **This is the cost of transparency.**
>
> Prediction markets? Same problem. Vote on a DAO proposal? Everyone knows how you voted.
>
> **DeFi needs privacy. Not just for criminals — for everyone.**"

---

## 💡 THE SOLUTION (0:50 - 1:30)

**[VISUAL: Lisan architecture diagram animates in — user → relayer → shielded pool → target contract]**

**VOICEOVER:**

> "Lisan solves this with **shielded balances** and **private contract calls**.
>
> Here's how it works:
>
> **Step 1:** You deposit Bitcoin, ETH, or any token into our **ShieldedPool** contract.
> *[Diagram shows tokens entering pool, Merkle tree updates]*
>
> **Step 2:** Your balance is hidden in a Merkle tree. Only you know the secret that unlocks it.
>
> **Step 3:** When you want to interact with a DeFi protocol — swap, bet, vote, lend — you generate a **zero-knowledge proof** locally in your browser.
> *[Show browser generating proof]*
>
> **Step 4:** You send that proof to a **decentralized relayer network**. The relayer submits your transaction to Starknet.
> *[Show relayer nodes competing]*
>
> **Step 5:** The ShieldedPool verifies your proof using **Garaga** — Starknet's on-chain ZK verifier — and forwards your call to the target contract.
> *[Show contract call flowing to AMM/DAO/Market]*
>
> **The target contract never sees WHO made the call.** Only that a valid proof was verified by the ShieldedPool.
>
> **Privacy without trust. Composability without compromise.**"

---

## 🎮 LIVE DEMO (1:30 - 3:30)

**[VISUAL: Switch to live Lisan frontend demo]**

**VOICEOVER:**

> "Let me show you this in action. Here's the Lisan app.
>
> ---
>
> ### **Demo 1: Private Deposit**
>
> *[Navigate to Deposit page]*
>
> I'm depositing 5 testnet BTC into the ShieldedPool.
> *[Click 'Deposit', show transaction pending]*
>
> Transaction confirmed. My BTC is now shielded. Let's check the blockchain.
> *[Open Voyager/Starkscan block explorer]*
>
> You can see the deposit transaction... but you **can't** see:
> - Which address I'll withdraw to later
> - How much I'll withdraw
> - What I'll do with this balance
>
> **It's just a commitment. A cryptographic fingerprint. Nothing more.**
>
> ---
>
> ### **Demo 2: Private Swap**
>
> *[Navigate to Swap page]*
>
> Now let's swap 2 BTC for USDC using a mock AMM — all from my shielded balance.
>
> *[Enter swap details: 2 BTC → USDC]*
>
> I click 'Generate Proof.' This happens **client-side** — Lisan never sees my secrets.
> *[Show proof generation progress bar]*
>
> Proof generated. Now I send it to a relayer.
> *[Show relayer selection UI]*
>
> Relayer submits my transaction. Let's check the blockchain again.
> *[Open explorer]*
>
> You see a transaction from the ShieldedPool to the AMM contract.
> But you **don't** see:
> - Who initiated the swap
> - Which deposit this came from
> - Where the USDC went after
>
> **The AMM thinks the ShieldedPool is swapping. It has no idea I'm behind it.**
>
> ---
>
> ### **Demo 3: Private Prediction Market Bet**
>
> *[Navigate to Prediction Markets page]*
>
> Let's bet 1 BTC on 'Yes' for a prediction market — 'Will ETH hit $5000 by March?'
>
> *[Select market, choose 'Yes', enter 1 BTC]*
>
> Generate proof. Submit via relayer. Done.
> *[Transaction confirms]*
>
> Now check the prediction market contract.
> *[Open market contract state]*
>
> It shows:
> - 1 BTC bet on 'Yes'
> - From address: **ShieldedPool**
>
> **No one knows I'm a bull on ETH.** No one can front-run my position. **My alpha stays mine.**
>
> ---
>
> ### **Demo 4: Private Withdrawal**
>
> *[Navigate to Withdraw page]*
>
> Finally, let's withdraw 1 BTC to a fresh address — completely unlinkable to my deposit.
>
> *[Enter recipient address, amount, generate proof]*
>
> Proof verified. BTC withdrawn to the new address.
> *[Show blockchain explorer]*
>
> The blockchain shows:
> - ShieldedPool → new address: 1 BTC
>
> But there's **no link** between:
> - My original deposit
> - The swaps I made
> - The bet I placed
> - This withdrawal
>
> **Privacy-preserving. Unlinkable. Unbreakable.**"

---

## 🏆 WHY LISAN WINS (3:30 - 4:15)

**[VISUAL: Split screen — Tornado Cash logo vs Lisan logo, with feature comparison]**

**VOICEOVER:**

> "You might ask: 'Isn't this just Tornado Cash?'
>
> **No. Lisan is better. Here's why:**
>
> ---
>
> ### **1. Unified Pool vs Isolated Pools**
>
> - **Tornado Cash:** Separate pools for 0.1 ETH, 1 ETH, 10 ETH.
>   → Smaller anonymity sets. Easier to link deposits to withdrawals.
>
> - **Lisan:** One pool for ALL amounts, ALL tokens, ALL actions.
>   → Larger anonymity set. Harder to trace.
>
> ---
>
> ### **2. Cross-Contract Composability**
>
> - **Tornado Cash:** Deposit. Wait. Withdraw. That's it.
>
> - **Lisan:** Deposit. Swap. Bet. Vote. Lend. Withdraw. **All from the same pool.**
>
> ---
>
> ### **3. Decentralized Relayers**
>
> - **Tornado Cash:** Relied on centralized relayers. When they shut down, privacy died.
>
> - **Lisan:** Economic incentives keep relayers live forever. No single point of failure.
>
> ---
>
> ### **4. Built for Starknet**
>
> - **Tornado Cash:** Ethereum gas fees = $50+ per withdrawal.
>
> - **Lisan:** Starknet = cheap proofs, fast finality, native ZK verification via Garaga.
>
> **Lisan isn't a clone. It's an evolution.**"

---

## 🚀 WHAT'S NEXT (4:15 - 4:45)

**[VISUAL: Roadmap graphic fades in]**

**VOICEOVER:**

> "Here's what's next for Lisan:
>
> ✅ **Today:** Bitcoin and mock ERC20 support
> 🔄 **Next week:** ETH, USDC, STRK — all major Starknet assets
> 📱 **Next month:** Mobile wallet integration
> 🔐 **Q2 2026:** Security audit + mainnet launch
> 🌍 **Q3 2026:** Cross-chain privacy (Bitcoin L1 → Starknet L2)
>
> We're not building a feature. **We're building infrastructure.**
>
> Privacy isn't optional. It's essential.
>
> And Lisan makes it accessible."

---

## 🎯 CLOSING (4:45 - 5:00)

**[VISUAL: Lisan homepage with tagline, fade to black]**

**VOICEOVER:**

> "**Lisan** — Do anything on Starknet. No one knows it's you.
>
> Try the demo at **lisan-demo.vercel.app**.
> Read the code at **github.com/yourusername/lisan**.
>
> Privacy for the DeFi masses.
>
> **Built on Starknet. Protected by math. Powered by you.**"

**[END CARD: Lisan logo + links + "RE{DEFINE} Hackathon 2026"]**

---

## 🎥 PRODUCTION NOTES

### Recording Checklist:
- [ ] Clear microphone (Blue Yeti / Shure SM7B recommended)
- [ ] Screen recording at 1080p 60fps (OBS / QuickTime)
- [ ] Browser window maximized (hide bookmarks bar)
- [ ] Dark mode enabled (looks better on camera)
- [ ] Pre-populate test data (no waiting for confirmations during recording)
- [ ] Use Voyager/Starkscan testnet explorers (Sepolia)

### Editing Tips:
- Speed up proof generation (2x speed + "Proof generation in progress..." overlay)
- Add captions for technical terms (Merkle tree, nullifier, Garaga)
- Highlight key text on screen with arrows/circles
- Background music: subtle, non-distracting (copyright-free)
- Export at 1080p H.264 for Dorahacks/YouTube upload

### Timing Targets:
- **2-3 min version:** Cut Demo 3 (bet), keep deposit + swap + withdrawal
- **5 min version:** Full script above
- **30 sec teaser:** Opening (0:00-0:20) + Demo 2 swap (sped up) + Closing tagline

---

## 🎬 FINAL CHECKLIST

Before uploading:
- [ ] Check audio levels (no clipping, no silence)
- [ ] Verify all text overlays are readable
- [ ] Test video on mobile (small screen legibility)
- [ ] Add YouTube chapters (0:00 Intro, 0:20 Problem, 0:50 Solution, etc.)
- [ ] Include links in video description (GitHub, demo, Twitter)
- [ ] Upload to:
  - [ ] Dorahacks submission page
  - [ ] YouTube (unlisted if required)
  - [ ] Twitter (teaser version)

---

**Good luck! 🚀**
