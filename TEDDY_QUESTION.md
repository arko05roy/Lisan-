# TEDDY OFFICE HOURS QUESTION — FEB 3, 10:00 PM IST

## CONTEXT
- **Who:** Teddy Woodward (@franklyteddy) — Privacy Lead
- **Format:** Zoom group session, drop question in chat box, Teddy picks and answers verbally
- **Goal:** Make his eyes raise with technical depth, validate privacy approach
- **Intelligence:** Teddy is "privacy geek" — deeply technical, can handle advanced privacy primitives

---

## THE QUESTION (COPY-PASTE TO ZOOM CHAT)

### OPTION A — PRIVATE MEV PROBLEM (RECOMMENDED 🔥)

```
Teddy — I built a shielded pool for Bitcoin on Starknet with cross-contract execution: balance hidden via Merkle commitments, SNARK proofs verify Merkle inclusion + nullifier for spend prevention, relayers submit proofs to preserve user anonymity.

The problem: relayers see proof calldata (target contract + function selector) before submission. For private swaps, relayers learn: "someone is swapping X→Y at time T" even if amounts/identity stay hidden.

This creates a private MEV problem: relayers can front-run based on calldata pattern recognition, even without knowing exact amounts. Encrypted calldata solves this but breaks composability (target contract can't parse encrypted calls).

For privacy DeFi beyond transfers—does privacy track value solving the private MEV problem (encrypted compute, TEE-based relayers, delayed execution), or is calldata leakage acceptable if identity+amounts stay hidden?

What gets privacy judges excited: maximum anonymity or practical composability with acceptable leakage?
```

**Character count:** ~850 characters (fits in Zoom chat)

**Why this DESTROYS:**
1. ✅ **Technical depth:** Merkle commitments, SNARK proofs, nullifiers, MEV, encrypted compute, TEEs
2. ✅ **Novel problem:** Private MEV in DeFi composability (cutting-edge research territory)
3. ✅ **Shows systems thinking:** You understand the relayer trust model creates new attack vectors
4. ✅ **Tradeoff clarity:** Encrypted calldata vs composability (you've thought it through)
5. ✅ **Connects to build:** Directly relevant to your relayer network architecture
6. ✅ **Forces engagement:** Not a yes/no question—requires nuanced technical answer
7. ✅ **"Eye raise" factor:** 🔥🔥🔥 Privacy researchers LOVE this kind of problem

**What you're really asking:**
"I found a fundamental tradeoff in private DeFi infrastructure. Which side should I optimize for?"

**Expected response paths:**

| Teddy Says | What It Means | Your Action |
|------------|---------------|-------------|
| "Calldata leakage is acceptable if amounts stay hidden" | 🟢 GREEN — Practical composability > perfect privacy | Keep current architecture, mention awareness of tradeoff |
| "Private MEV is a real problem, needs solving" | 🟡 YELLOW — Deeper privacy expected | Consider mentioning encrypted compute as future work |
| "TEE-based relayers or delayed execution" | 🟢 GREEN — He's engaging deeply | Note this for future work section |
| "Most DeFi doesn't need perfect privacy" | 🟢 GREEN — Your approach validated | Lead with composability in Privacy track pitch |
| Asks YOU a follow-up question | 🟢🟢 JACKPOT — Real interest | Answer + ask "Should I prioritize this for submission?" |

---

### OPTION B — NULLIFIER LINKABILITY ACROSS CONTRACTS

```
Teddy — built private Bitcoin execution layer for Starknet: Merkle tree commitments, SNARK proofs, nullifier tracking. Users can call any DeFi contract privately (swaps, predictions, voting).

Privacy issue: nullifiers are contract-specific (AMM nullifier ≠ Prediction nullifier). But if a user calls 3 different contracts from same commitment, there are 3 nullifiers with temporal correlation. Statistical analysis could link: "same user called AMM at T1, Prediction at T2, Voting at T3" even if amounts/identity hidden.

Solutions: (1) Global nullifier pool (all contracts share nullifiers—breaks composability), (2) Nullifier padding (dummy nullifiers—gas cost), (3) Accept linkability risk for composability.

For privacy track: does "private DeFi" require unlinkability across contracts, or is per-contract privacy sufficient if identity+amounts stay hidden?
```

**Why this works:**
- Shows understanding of nullifier schemes
- Identifies cross-contract privacy leak (graph analysis attack)
- Presents clear tradeoffs
- Research-level question

**Use this if:** Private MEV already asked by someone else

---

### OPTION C — SELECTIVE DISCLOSURE IN PRIVATE DEFI

```
Teddy — building private Bitcoin DeFi for Starknet: shielded balance via Merkle commitments, SNARK proofs for private execution.

DeFi composability problem: lending protocols need to verify "user has ≥X collateral" without revealing exact balance. Current approach: prove Merkle inclusion of commitment (binary: you have funds or you don't). But lending needs: "prove balance ≥ threshold" without revealing exact amount.

This requires range proofs in SNARK circuits (balance ≥ X). Bulletproofs solve this but Starknet doesn't have native Bulletproof verification. Options: (1) Build range proof circuit in Cairo (expensive), (2) Overprovision collateral (privacy leak), (3) Limit composability to protocols that don't need selective disclosure.

For privacy track: do judges expect privacy DeFi to solve selective disclosure, or is binary proof (have funds Y/N) sufficient for most DeFi use cases?
```

**Why this works:**
- Shows understanding of range proofs, Bulletproofs, circuit complexity
- Identifies Starknet-specific constraint
- Practical implementation question

**Use this if:** Private MEV AND nullifier linkability already asked

---

## MY RECOMMENDATION: USE OPTION A (PRIVATE MEV)

**Reasons:**
1. **Highest "eye raise" factor** — This is novel, cutting-edge problem space
2. **Directly connects to relayer network** — You're building the thing that creates this problem
3. **Shows forward-thinking** — You're not just building, you're identifying next-level challenges
4. **Debate-worthy** — Privacy researchers have strong opinions on MEV + privacy tradeoffs
5. **Positions you as infrastructure thinker** — Not just "I built a thing," but "I understand the systemic implications"

---

## DELIVERY STRATEGY

### Before Session:
1. **Copy Option A to clipboard** (ready to paste)
2. **Join Zoom 2-3 min early** (test chat functionality)
3. **Listen to first 2-3 questions** (gauge session tone, ensure yours isn't duplicate)

### During Session:
1. **Wait for natural pause** (after Teddy finishes answering someone)
2. **Paste in chat** (no preamble, no apology for length)
3. **Don't send follow-up messages** (let the question stand on its own)
4. **Take notes on Teddy's response** (exact words, tone, follow-ups)

### After Teddy Answers:
Send ONE follow-up message in chat:
```
Got it. [1-sentence summary of his answer]. Composability with acceptable leakage makes sense for practical DeFi. Thanks Teddy.
```

This shows:
- You understood his answer
- You're not rambling
- You respected his time
- You're decisive (not endlessly debating)

### Post-Session:
**Report to me (10:00 PM IST check-in):**
1. Teddy's EXACT words (no interpretation)
2. His tone (excited, neutral, redirecting)
3. Any follow-up questions he asked YOU
4. What other builders asked (reveals privacy track priorities)
5. Your read on whether he was impressed

---

## BACKUP QUESTION (if someone asks similar)

If another builder asks about private MEV or relayer trust:

```
Teddy — for privacy track submissions, should projects lead with privacy primitives (ZK proofs, commitments, nullifiers) or DeFi use cases (private swaps, lending)? What resonates more with privacy judges?
```

This is simpler, still shows technical awareness, and helps you frame your submission.

---

## WHY THIS MATTERS

**Validation you're seeking:**
1. Is calldata leakage acceptable? (Architecture decision)
2. Does privacy track care about MEV in private systems? (Differentiation opportunity)
3. Composability vs perfect privacy: which matters more? (Narrative direction)

**What this positions:**
- You as: Infrastructure-level thinker (not just app builder)
- Your project as: Cutting-edge privacy research territory (not just "Tornado but composable")
- Your depth as: You understand trust models, attack vectors, systemic tradeoffs

**Post-Teddy strategy:**
- If he validates composability > perfect privacy: Lead Privacy track submission with "practical private DeFi" angle
- If he wants deeper privacy: Add "encrypted compute relayer network" to future work section
- If he's excited: You have Privacy track validation to match Adrien's Bitcoin track validation

---

## CONFIDENCE CHECK

**You're ready if:**
- ✅ You understand the private MEV problem (relayers seeing calldata)
- ✅ You can explain the tradeoff (encrypted calldata breaks composability)
- ✅ You're comfortable defending your architecture choice (practical composability)
- ✅ You're mentally prepared for "Why didn't you solve this?" (Answer: "Time constraint, but I'm aware of it and have solution paths")

**You need more prep if:**
- ❌ You can't explain what "encrypted compute" means
- ❌ You don't know what TEE (Trusted Execution Environment) is
- ❌ You can't defend why calldata visibility is acceptable

---

## GO TIME

**Session:** Feb 3, 10:00 PM IST
**Your weapon:** Option A (Private MEV question)
**Your goal:** Make Teddy's eyes raise + validate privacy approach
**Your mindset:** You built real privacy infrastructure. This question shows you understand the cutting edge. Own it.

**PASTE IT. DROP IT. OWN IT.**

Report back with Teddy's exact words. Let's decode his response and lock your Privacy track narrative.

🔥 GO MAKE TEDDY THINK.
