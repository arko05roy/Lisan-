# DemoCounter - Private Execute Demo Guide

## Contract Information

**Contract Address:** `0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde`

**Voyager Explorer:** https://sepolia.voyager.online/contract/0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde

**Deployed:** Feb 1, 2026 (Sepolia Testnet)

---

## What is DemoCounter?

A simple counter contract designed to demonstrate **private execute** functionality. It tracks:
- A counter value (starts at 0)
- The last caller address
- Total number of increments

**Key Feature:** When called via `private_execute`, the `last_caller` will be the **ShieldedPool address**, not your wallet — proving the privacy layer works!

---

## Contract Functions

### 1. `increment()`
- Increments counter by 1
- Stores caller address
- Emits `Incremented` event

### 2. `get_count()`
- Returns current counter value

### 3. `get_last_caller()`
- Returns address of the last caller
- **Demo Key:** This will show ShieldedPool address when called privately!

---

## How to Use with Private Execute

### Step 1: Deposit Funds
1. Go to `/deposit` page
2. Deposit some tokens (mBTC, mSTRK, or DEMO)
3. Wait for confirmation

### Step 2: Execute Privately
1. Go to `/execute` page
2. Select relayer (must be online)
3. Select your shielded note
4. **Target Contract:** `0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde`
5. **Function Name:** `increment`
6. **Amount:** `0` (this call doesn't require tokens)
7. **Calldata:** *(leave empty - increment takes no parameters)*

### Step 3: Verify Privacy
After transaction confirms:
1. Go to Voyager explorer
2. Click on the DemoCounter contract
3. Call `get_last_caller()`
4. **Result:** You'll see the ShieldedPool address, NOT your wallet!

---

## Updated Contract Information (Feb 1, 2026)

**New ShieldedPool Address:** `0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2`

⚠️ **Important**: If you have existing deposits from before this update, you'll need to make fresh deposits to the new pool contract. Old notes won't work with the updated contract.

## Calldata Reference

### Call: `increment()`
**Function Name:** `increment`
**Calldata:** *(empty)* or just leave the field blank

The increment function takes no parameters, so no calldata is needed.

---

## Understanding the Privacy

### Normal Call (Without Private Execute)
```
Your Wallet → DemoCounter.increment()
   ↓
last_caller = 0x1234...5678 (YOUR address)
```

### Private Call (With Private Execute)
```
Your Wallet → [ZK Proof] → Relayer → ShieldedPool → DemoCounter.increment()
   ↓
last_caller = 0x0537...2cba (ShieldedPool address)
```

**Nobody knows you called the contract!**

---

## Demo Script for Video

```
NARRATOR: "Let's prove the privacy layer works."

[Screen: Execute page]
NARRATOR: "I'll call this counter contract privately."

[Fill form]
Target: 0x05cd...4fde
Function Name: increment
Amount: 0
Calldata: (empty)

[Click Execute]
NARRATOR: "Generating proof... submitting via relayer..."

[Wait for confirmation]
NARRATOR: "Transaction confirmed. Now let's check who called it."

[Go to Voyager]
NARRATOR: "The contract shows the POOL address called it — not me."

[Highlight last_caller on Voyager]
NARRATOR: "My wallet? Completely hidden. Privacy verified."
```

---

## Advanced: Call `increment_by(amount)`

If you want to increment by a custom amount, you'd need to construct calldata:

**Function:** `increment_by(amount: u64)`

**Calldata Example (increment by 5):**
```
5
```

Just enter `5` in the calldata field.

---

## Expected Events

After calling via private execute, the `Incremented` event will show:
- **caller:** `0x05379c158a4a1490655dfba5627d2ce6d2cbe4f4341696f4e80d0dc6560c2cba` (ShieldedPool)
- **new_count:** (previous count + 1)

---

## Troubleshooting

**Error: "Amount exceeds shielded balance"**
- Set Amount to `0` — increment doesn't need tokens

**Error: "No pending withdrawal"**
- This is a normal function call, not a withdrawal

**Calldata field confusing?**
- Leave it blank for `increment()`
- Only fill it for custom functions

---

## Next Steps

Once this demo works:
1. Try calling other contracts (AMMs, lending, etc.)
2. Add more complex calldata
3. Show composability in your demo video

**This proves Lisan can interact with ANY Starknet contract privately!**
