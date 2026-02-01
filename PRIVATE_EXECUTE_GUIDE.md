# Private Execute Feature - Complete Implementation Guide

## Status: ✅ FULLY IMPLEMENTED

The private execute functionality is **already implemented** in both the smart contracts and frontend. This guide explains how to use it.

---

## What is Private Execute?

Private Execute enables **cross-contract composability with privacy**. It allows you to:

- Call ANY Starknet contract using your shielded funds
- Keep your identity hidden (the pool contract acts as proxy)
- Execute complex DeFi operations privately
- Receive change back as a new shielded commitment

**Privacy Guarantee:** On-chain observers only see the ShieldedPool contract calling the target contract — your wallet address is never exposed.

---

## Architecture

### Contract Implementation

**Location:** `lisan_contracts/src/shielded_pool.cairo` (lines 283-362)

**Function Signature:**
```cairo
fn private_execute(
    ref self: ContractState,
    full_proof_with_hints: Span<felt252>,     // ZK proof
    root: felt252,                            // Merkle root
    nullifier_hash: felt252,                  // Prevents double-spend
    token_address: ContractAddress,           // Which token to use
    amount: u256,                             // Amount to send to target
    target_contract: ContractAddress,         // Contract to call
    call_data: Span<felt252>,                // Raw calldata
    change_commitment: felt252,               // New commitment for change
    change_amount: u256,                      // Amount to keep shielded
)
```

**Execution Flow:**
1. **Verify Merkle root** — Ensures commitment exists in tree
2. **Check nullifier** — Prevents double-spending
3. **Verify ZK proof** — Proves ownership of `amount + change_amount` tokens
4. **Approve tokens** — Pool approves target contract to spend `amount`
5. **Call external contract** — Uses `call_contract_syscall` with user's calldata
6. **Reset approval** — Security: removes approval after call
7. **Insert change commitment** — If change_amount > 0, creates new shielded note
8. **Update balances** — Decrements pool balance by spent amount
9. **Emit event** — `PrivateExecute` event (no sender address!)

---

## Frontend Implementation

### Page Location
**Path:** `client/app/(app)/execute/page.tsx` ✅ **CREATED**

### Component
**Path:** `client/components/privacy/private-execute.tsx` ✅ **EXISTS**

### Relayer API
**Path:** `client/app/api/relay/private-execute/route.ts` ✅ **EXISTS**

### Navigation
**Navbar updated:** Execute link added between Trade and Explore ✅

---

## How to Use (User Flow)

### Step 1: Deposit Funds into Shielded Pool
1. Go to **Pool** page
2. Select a token (mBTC, mSTRK, DEMO, or custom ERC20)
3. Deposit amount → creates shielded commitment

### Step 2: Navigate to Execute Page
1. Click **Execute** in the navbar
2. You'll see the Private Execute interface

### Step 3: Fill Out the Form

**1. Select Relayer**
- Choose an online relayer from the dropdown
- The relayer submits the transaction on your behalf (hiding your wallet)

**2. Select Shielded Note**
- Pick which shielded note to spend
- Shows: token type, amount, creation date

**3. Target Contract Address**
- Enter the Starknet contract you want to call
- Example: `0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde` (DemoCounter)

**4. Function Name**
- The name of the function to call on the target contract
- Example: `increment`, `transfer`, `approve`
- The selector is computed automatically from the function name

**5. Amount to Send**
- How much to send to the target contract
- Must be ≤ your shielded note balance
- For demo: use `0` for increment (no tokens needed)

**6. Calldata**
- Comma-separated felt252 values for function parameters
- Example: `0x123, 0x456, 0x789`
- Leave empty for functions with no parameters (like `increment`)

### Step 4: Execute
1. Click **Execute Privately**
2. Wait for proof generation (happens in browser)
3. Relayer submits transaction
4. Transaction is confirmed
5. **Result:**
   - Target contract receives approved tokens and executes your call
   - Change (if any) is returned as a new shielded note
   - Your identity remains hidden

### Step 5: Verify Privacy (Optional)
1. Go to [Starkscan](https://sepolia.starkscan.co) and search for your transaction hash
2. Check the **Events** tab
3. Look for events from the target contract (e.g., `Incremented` from DemoCounter)
4. Verify the `caller` is the **ShieldedPool address**, not your wallet!

---

## Example Use Cases

### 1. Private Swap on External AMM
```
Target Contract: 0x...JediSwap_Router
Amount: 0.5 (mBTC)
Calldata: [swap_function_selector, token_in, token_out, min_amount_out, ...]
```

### 2. Private Lending Protocol Deposit
```
Target Contract: 0x...zkLend_Pool
Amount: 1.0 (mBTC)
Calldata: [deposit_selector, collateral_token, ...]
```

### 3. Private NFT Purchase
```
Target Contract: 0x...NFT_Marketplace
Amount: 0.1 (mBTC)
Calldata: [buy_nft_selector, nft_id, ...]
```

### 4. Private Governance Vote (External DAO)
```
Target Contract: 0x...DAO_Governor
Amount: 0.0 (just interaction, no transfer)
Calldata: [vote_selector, proposal_id, choice, ...]
```

---

## Technical Details

### Proof Verification
- Reuses the **withdraw verifier circuit** (4 public inputs)
- Public inputs: `[root, nullifierHash, tokenAddress, totalAmount]`
- Where `totalAmount = amount + change_amount`
- Circuit proves: "I own a commitment for X tokens at this Merkle root"

### Change Handling
- If you spend less than your full note balance, the change is returned
- A new random commitment is generated for the change
- The change commitment is inserted into the Merkle tree
- You can spend it later just like any other note

### Security Properties
1. **Privacy:** Target contract doesn't know who called it (only sees pool address)
2. **Non-repudiation:** ZK proof ensures only the commitment owner can execute
3. **Double-spend prevention:** Nullifier is marked used
4. **Atomicity:** If external call fails, entire transaction reverts (no funds lost)
5. **Approval safety:** Approval is reset to 0 after call completes

---

## Contract Addresses (Sepolia Testnet)

**Updated Feb 1, 2026** - New ShieldedPool deployment with function selector fix

```
ShieldedPool:      0x01156462ef834c9224596cbb8d9bba9d3a8645b8866349f376c7210f1d961ff2
DemoCounter:       0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde
MockBTC:           0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f
MockSTRK:          0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f
Demo Token (DEMO): 0x027df6930982a894721f63e4d3f4e813953f959f967f51e6c779778e7cb0af81
```

**Old Pool (Deprecated):** `0x05379c158a4a1490655dfba5627d2ce6d2cbe4f4341696f4e80d0dc6560c2cba`

---

## Verifying Transactions

After executing, you can verify the transaction on [Voyager Explorer](https://sepolia.voyager.online):

1. Search for the transaction hash
2. **Event logs** will show:
   - `PrivateExecute` event from ShieldedPool
   - Target contract events (e.g., swap, deposit, etc.)
3. **Caller address** in target contract events will be the **ShieldedPool** — not your wallet!

---

## Testing Checklist

- [ ] Deposit funds into pool (any token)
- [ ] Navigate to Execute page
- [ ] Select relayer (must be online)
- [ ] Select shielded note
- [ ] Enter target contract (start with a simple ERC20 `approve` call)
- [ ] Enter amount < note balance (to test change)
- [ ] Enter calldata (e.g., `[recipient_address_low, recipient_address_high, amount_low, amount_high]` for approve)
- [ ] Click Execute Privately
- [ ] Verify transaction on Voyager
- [ ] Check that change note appears in your notes list

---

## Advanced: Constructing Calldata

For complex contract interactions, you need to construct the calldata manually:

### Example 1: DemoCounter increment()
```
Target Contract: 0x05cd6bf538cce43d878333acd194d24365808810bad5ae3cf1b65e043da94fde
Function Name: increment
Amount: 0
Calldata: (leave empty)
```

### Example 2: ERC20 Approve
```
Target Contract: 0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f (MockBTC)
Function Name: approve
Amount: 0
Calldata: <spender_address>, <amount_low>, <amount_high>
```

For u256 amounts, split into low/high:
```typescript
const approveAmount = 1000n * 10n**18n; // 1000 tokens
const low = approveAmount & ((1n << 128n) - 1n);
const high = approveAmount >> 128n;
// Calldata: spenderAddress, low, high
```

### Example: AMM Swap
Consult the target AMM's contract ABI to construct the exact calldata needed for the swap function.

---

## Known Limitations

1. **Calldata complexity:** User must manually construct calldata (no UI builder yet)
2. **Return values:** Function doesn't capture return data from external call
3. **Gas estimation:** May require manual gas adjustment for complex calls
4. **Approvals:** Only approves exact amount (no infinite approvals)

---

## Future Enhancements

1. **Calldata Builder UI:** Visual interface for constructing common function calls
2. **Contract Templates:** Pre-built templates for popular protocols (Jedi, zkLend, etc.)
3. **Multi-call:** Execute multiple calls in one transaction
4. **Return data capture:** Store and display return values from external calls
5. **Simulation:** Preview execution before submitting

---

## Summary

✅ **Contracts:** Fully implemented and deployed
✅ **Relayer API:** Implemented and functional
✅ **Frontend Component:** Built with proof generation
✅ **Page:** Created at `/execute`
✅ **Navigation:** Added to navbar
✅ **Documentation:** This guide

**The private execute feature is production-ready for testing!**

Go to http://localhost:3000/execute (or your deployed URL) to start using it.
