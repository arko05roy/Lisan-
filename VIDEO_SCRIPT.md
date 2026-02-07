# Lisan — Video Script

**Target:** Hackathon judges + Starknet community
**Tone:** Clear, confident, demo-heavy
**Format:** Screen recording + voiceover
**Length:** 3-5 minutes

---

## OPENING (0:00 - 0:15)

**[VISUAL: Lisan landing page hero section]**

> Every transaction on a public blockchain is visible. Your swaps, your bets, your votes — everyone can see them.
>
> Lisan changes that. It's a privacy layer for Starknet — prediction markets, governance voting, instant swaps, transfers — all from a shielded balance, using a wallet you already know.

---

## THE PROBLEM (0:15 - 0:45)

**[VISUAL: Starkscan explorer showing a swap transaction — highlight the visible wallet, amount, timestamp]**

> Let me show you the problem.
>
> Here's a swap on Starknet. The wallet address — public. The amount — public. The timestamp — public. MEV bots see this and front-run the trade before it settles.
>
> Prediction markets are worse. If you bet big on an outcome, copy-traders follow your position. Your alpha is everyone's alpha.
>
> And governance? Your DAO vote is on-chain. Whales face social pressure. Early voters influence late voters. There's no secret ballot.
>
> The only privacy solution that existed — Tornado Cash — only lets you deposit and withdraw. You can't swap. You can't bet. You can't vote. And their isolated pools fragment the anonymity set.

---

## THE SOLUTION (0:45 - 1:20)

**[VISUAL: Lisan architecture diagram animating step by step]**

> Lisan is different. You deposit any ERC20 token — BTC, STRK, USDC, anything — into a unified shielded pool. Then you interact with DeFi privately.
>
> Here's the flow:
>
> You connect your wallet — ArgentX or Braavos, the same wallets you already use on Starknet. You deposit tokens. Your balance becomes a cryptographic commitment in a Merkle tree — only you know the secret.
>
> When you want to act — swap, bet, vote, transfer — your browser generates a zero-knowledge proof locally. Your secrets never leave the browser.
>
> You pick a relayer from our decentralized network. The relayer submits your proof on-chain. The ShieldedPool verifies it using Garaga — Starknet's native ZK verifier — and forwards your call to the target contract.
>
> The target contract has no idea who you are. It just sees a call from the ShieldedPool.

---

## LIVE DEMO (1:20 - 3:40)

**[VISUAL: Switch to Lisan app in browser]**

> Let me show you. Here's Lisan running on Starknet Sepolia.

### Demo 1: Deposit (1:20 - 1:50)

**[VISUAL: Navigate to Deposit page, connect wallet]**

> I'm connected with Braavos. I'll deposit 5 BTC into the shielded pool.
>
> *[Select BTC token, enter amount, click Deposit]*
>
> Transaction confirmed. My BTC is now shielded.
>
> *[Open Starkscan]*
>
> On the explorer, you see a deposit into the ShieldedPool contract at `0x0115...1ff2`. But you can't see what I'll do next — withdraw, swap, bet — or to which address. It's just a commitment.

### Demo 2: Private Swap (1:50 - 2:20)

**[VISUAL: Navigate to Swap page]**

> Now I'll swap 2 BTC for STRK — privately.
>
> *[Enter swap amount, show the live quote from pool reserves]*
>
> The AMM shows me a quote based on real-time reserves. I click swap. My browser generates a Groth16 proof — this takes a few seconds.
>
> *[Show proof generating, then relayer selection]*
>
> I pick a relayer — they'll earn 0.5% for submitting this. Transaction confirmed.
>
> *[Open explorer]*
>
> The blockchain shows a swap from the ShieldedPool to the AMM contract at `0x0247...68a1`. But there's no trace back to my wallet. The AMM thinks the ShieldedPool is trading. It has no idea I'm behind it.

### Demo 3: Private Prediction Market Bet (2:20 - 2:55)

**[VISUAL: Navigate to Predict page]**

> This is where it gets interesting. Here are live prediction markets.
>
> *[Show market list — status badges, pool sizes, countdowns]*
>
> I'll bet 1 BTC on "Yes" for this market. My position is hidden — the contract stores a bet commitment, not my address or my side.
>
> *[Enter bet, generate proof, submit via relayer]*
>
> Transaction confirmed. Let's check the PredictionMarket contract at `0x04de...e559`.
>
> *[Open explorer]*
>
> It shows a bet was placed. But not by whom. Not which side. Not the amount. No one can copy my trade. No one can front-run my position.
>
> After the oracle resolves the market, I claim my winnings with a ZK proof that proves I bet correctly — without revealing my original bet.

### Demo 4: Private Governance Vote (2:55 - 3:20)

**[VISUAL: Navigate to Vote page]**

> Now governance. Here's an active proposal with three options.
>
> *[Show proposal details — options, vote count, deadline]*
>
> I'll cast my vote. My choice is hidden behind a commitment — the contract only stores a hash. No one knows how I voted.
>
> *[Select option, submit vote]*
>
> During the voting period, all choices stay secret. After the deadline, anyone can trigger the tally — all votes are revealed in batch, and the winner is computed on-chain. True secret ballot governance.

### Demo 5: Private Withdrawal (3:20 - 3:40)

**[VISUAL: Navigate to Withdraw page]**

> Finally, I'll withdraw 1 BTC to a completely fresh address.
>
> *[Enter new recipient address, generate proof, submit]*
>
> Done. The blockchain shows BTC leaving the ShieldedPool to a new address. But there's no link between my original deposit, the swaps, the bet, the vote, and this withdrawal. All unlinkable.

---

## WHAT MAKES LISAN DIFFERENT (3:40 - 4:15)

**[VISUAL: Comparison table on screen — Lisan vs Tornado Cash]**

> So how is this different from Tornado Cash?
>
> Tornado Cash has isolated pools — 0.1 ETH, 1 ETH, 10 ETH. Small anonymity sets. Easy to trace. And all you can do is deposit and withdraw.
>
> Lisan has one unified pool for all tokens, all amounts, all actions. Larger anonymity set. And you can actually do things — swap, bet, vote, transfer — all from the same pool.
>
> Tornado's relayers were centralized. When they got shut down, privacy died. Lisan's relayers are decentralized with staking and slashing — economic incentives keep them running.
>
> And the UX? You connect the wallet you already have — ArgentX or Braavos. Any ERC20 token works. Instant swaps, instant withdrawals. No new interface to learn.
>
> Tornado was deposit-and-withdraw. Lisan is a full private DeFi platform.

---

## CLOSING (4:15 - 4:30)

**[VISUAL: Lisan landing page, fade to logo + tagline]**

> Lisan — nine smart contracts deployed on Starknet Sepolia. A shielded pool, a private AMM, prediction markets, governance voting, a decentralized relayer network. All verifiable on-chain via Garaga.
>
> Do anything on Starknet. No one knows it's you.

**[END CARD: Lisan logo + "RE{DEFINE} Hackathon 2026" + GitHub link]**

---

## PRODUCTION NOTES

### Recording
- Screen record at 1080p 60fps (OBS or QuickTime)
- Browser maximized, dark mode, bookmarks bar hidden
- Pre-populate test data so there's no waiting for confirmations
- Use Starkscan Sepolia explorer for on-chain verification

### Editing
- Speed up proof generation to 2x with an overlay ("Generating proof...")
- Add captions for technical terms on first mention (Merkle tree, nullifier, Garaga)
- Background music: subtle, copyright-free
- Export 1080p H.264

### Cut Versions
- **2-3 min:** Cut Demo 4 (voting), shorten Demo 3 (bet)
- **30 sec teaser:** Opening line + one swap demo (sped up) + closing tagline
