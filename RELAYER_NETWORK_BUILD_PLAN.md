# DECENTRALIZED RELAYER NETWORK — BUILD PLAN
**Project:** Lisan (Private Bitcoin DeFi for Starknet)
**Timeline:** Feb 3-20, 2026 (18 days)
**Deadline:** Feb 20, 2026
**Kill Switch:** Feb 8 EOD (Day 11) — Cut if not working

---

## PHASE 1: RELAYER NETWORK BUILD (Days 6-11: Feb 3-8)

---

### DAY 6 — FEB 3 (Architecture Design)

**Goal:** Design relayer architecture, attend Teddy office hours

**Morning (9:00 AM - 1:00 PM):**
1. Design RelayerRegistry contract interface
   - `register_relayer(stake_amount: u256) -> u256` (returns relayer_id)
   - `unregister_relayer(relayer_id: u256)`
   - `slash_relayer(relayer_id: u256, penalty: u256)`
   - `get_active_relayers() -> Array<u256>`
   - Storage: `relayers: LegacyMap<u256, RelayerInfo>`

2. Design RelayerCoordinator contract interface
   - `select_relayer() -> u256` (selection logic)
   - `submit_proof(proof: Proof, relayer_id: u256) -> bool`
   - `distribute_fee(relayer_id: u256, fee: u256)`
   - `record_submission(relayer_id: u256, success: bool)`
   - Storage: `submission_counts: LegacyMap<u256, u256>`

3. Design incentive model
   - **Staking:** Relayers stake 1 BTC to register
   - **Fees:** 0.1% of transaction value goes to relayer
   - **Slashing:** 10% of stake slashed for failed submissions (3 strikes = full slash)
   - **Selection:** Round-robin initially, can upgrade to stake-weighted later

**Afternoon (2:00 PM - 6:00 PM):**
4. Design integration with PrivatePool
   - Update `execute` function to call `RelayerCoordinator.submit_proof()`
   - Keep existing single-relayer as fallback
   - Design relayer fee deduction from user's shielded balance

5. Write architecture document
   - Contract flows (user → coordinator → relayer → pool)
   - Fee distribution logic
   - Slashing conditions
   - Selection algorithm

**Evening (7:00 PM - 10:00 PM):**
6. Prepare for Teddy office hours (10:00 PM IST)
7. Attend Teddy session, ask prepared question (see separate section below)
8. Document Teddy's response

**Deliverable:**
- ✅ Architecture doc (contracts, flows, incentives)
- ✅ Contract interfaces designed
- ✅ Teddy validation received

**Check-in (10:00 PM IST):**
Report: Architecture design complete, Teddy feedback, Day 7 targets

---

### DAY 7 — FEB 4 (Core Contracts Implementation)

**Goal:** Build RelayerRegistry + RelayerCoordinator, attend Jonathan office hours

**Morning (9:00 AM - 1:00 PM):**
1. Implement RelayerRegistry.cairo
   ```cairo
   struct RelayerInfo {
       address: ContractAddress,
       stake: u256,
       active: bool,
       total_submissions: u256,
       failed_submissions: u256,
       earnings: u256,
   }

   fn register_relayer(ref self: ContractState, stake_amount: u256) -> u256 {
       // Check stake >= MIN_STAKE (1 BTC)
       // Transfer stake from caller to contract
       // Create RelayerInfo entry
       // Emit RelayerRegistered event
       // Return relayer_id
   }

   fn slash_relayer(ref self: ContractState, relayer_id: u256, penalty: u256) {
       // Only callable by RelayerCoordinator
       // Deduct penalty from stake
       // If stake < MIN_STAKE, deactivate relayer
       // Emit RelayerSlashed event
   }
   ```

2. Write tests for RelayerRegistry
   - Test registration with sufficient stake
   - Test registration rejection with insufficient stake
   - Test slashing mechanism
   - Test relayer deactivation after slash

**Afternoon (2:00 PM - 6:00 PM):**
3. Implement RelayerCoordinator.cairo
   ```cairo
   fn select_relayer(ref self: ContractState) -> u256 {
       // Get active relayers from RelayerRegistry
       // Round-robin selection (next_relayer_index % active_count)
       // Update next_relayer_index
       // Return selected relayer_id
   }

   fn submit_proof(
       ref self: ContractState,
       proof: Proof,
       relayer_id: u256,
       target_contract: ContractAddress,
       calldata: Array<felt252>
   ) -> bool {
       // Verify relayer is active
       // Forward proof to PrivatePool.execute()
       // If success: record_submission(relayer_id, true)
       // If failure: record_submission(relayer_id, false) + slash
       // Distribute fee to relayer
       // Return success/failure
   }

   fn distribute_fee(ref self: ContractState, relayer_id: u256, fee: u256) {
       // Update relayer earnings in RelayerRegistry
       // Emit FeeDistributed event
   }
   ```

4. Write tests for RelayerCoordinator
   - Test relayer selection (round-robin)
   - Test proof submission routing
   - Test fee distribution
   - Test slashing on failed submission

**Evening (7:00 PM - 10:00 PM):**
5. Run all tests, ensure passing
6. Prepare for Jonathan office hours (9:30 PM IST)
7. Attend Jonathan session, validate Bitcoin track breadth vs depth question
8. Document Jonathan's response

**Deliverable:**
- ✅ RelayerRegistry contract complete with tests
- ✅ RelayerCoordinator contract complete with tests
- ✅ All tests passing
- ✅ Jonathan validation received

**Check-in (10:00 PM IST):**
Report: Core contracts done, tests passing, Jonathan feedback, Day 8 targets

---

### DAY 8 — FEB 5 (Integration with PrivatePool)

**Goal:** Integrate relayer system with existing shielded pool

**Morning (9:00 AM - 1:00 PM):**
1. Update PrivatePool.cairo `execute` function
   ```cairo
   fn execute(
       ref self: ContractState,
       proof: Proof,
       target_contract: ContractAddress,
       calldata: Array<felt252>
   ) {
       // OLD: Direct proof verification
       // NEW: Call RelayerCoordinator.submit_proof()

       let coordinator = self.relayer_coordinator.read();
       let relayer_id = IRelayerCoordinator(coordinator).select_relayer();

       let success = IRelayerCoordinator(coordinator).submit_proof(
           proof, relayer_id, target_contract, calldata
       );

       assert(success, 'Relayer submission failed');

       // Calculate relayer fee (0.1% of tx value)
       let fee = self.calculate_relayer_fee(proof.amount);

       // Deduct fee from user's balance, distribute to relayer
       self.deduct_fee_from_balance(proof.nullifier, fee);
       IRelayerCoordinator(coordinator).distribute_fee(relayer_id, fee);
   }
   ```

2. Implement fee deduction logic
   - Calculate 0.1% of transaction value
   - Deduct from user's shielded balance
   - Track fees in separate accounting

3. Update commitment/balance tracking to handle fees
   - When user deposits 10 BTC, commitment = 10 BTC
   - When user executes, balance = 10 BTC - tx_value - relayer_fee
   - Ensure Merkle tree balance verification accounts for fees

**Afternoon (2:00 PM - 6:00 PM):**
4. Write integration tests
   - Test: Deposit → Execute via relayer → Balance updated correctly
   - Test: Relayer fee deducted from user balance
   - Test: Relayer earnings updated in Registry
   - Test: Failed relayer submission triggers slashing
   - Test: Fallback to next relayer if first fails

5. Test edge cases
   - User balance insufficient for tx + fee
   - All relayers inactive/slashed
   - Concurrent submissions from multiple users

**Evening (6:00 PM - 10:00 PM):**
6. Fix any integration bugs
7. Run full test suite (existing tests + new relayer tests)
8. Ensure no regressions in existing functionality

**Deliverable:**
- ✅ PrivatePool integrated with RelayerCoordinator
- ✅ Fee deduction logic working
- ✅ Integration tests passing
- ✅ No regressions in existing features

**Check-in (10:00 PM IST):**
Report: Integration complete, tests passing, Day 9 targets

---

### DAY 9 — FEB 6 (Deploy to Sepolia + Testing)

**Goal:** Deploy relayer contracts to Sepolia, test end-to-end

**Morning (9:00 AM - 1:00 PM):**
1. Deploy RelayerRegistry to Sepolia
   ```bash
   starkli declare RelayerRegistry.cairo
   starkli deploy <class_hash> --network sepolia
   ```

2. Deploy RelayerCoordinator to Sepolia
   ```bash
   starkli declare RelayerCoordinator.cairo
   starkli deploy <class_hash> <registry_address> --network sepolia
   ```

3. Update PrivatePool contract with RelayerCoordinator address
   ```bash
   starkli invoke <private_pool_address> set_relayer_coordinator <coordinator_address>
   ```

4. Verify all contracts on Voyager/Starkscan

**Afternoon (2:00 PM - 6:00 PM):**
5. Register 3 test relayers on Sepolia
   - Create 3 separate wallets
   - Stake 1 BTC each via `register_relayer()`
   - Verify relayers show as active

6. Test relayer selection
   - Call `select_relayer()` multiple times
   - Verify round-robin rotation

7. Test proof submission through relayer
   - User deposits 10 BTC to shielded pool
   - User generates proof for contract execution
   - Call `execute()` → routes through coordinator → relayer submits
   - Verify: relayer earns fee, user balance updated

**Evening (6:00 PM - 10:00 PM):**
8. Test slashing mechanism
   - Simulate failed submission (invalid proof)
   - Verify relayer gets slashed 10% of stake
   - Verify relayer deactivated after 3 failures

9. Test fee distribution
   - Multiple users execute transactions
   - Verify relayers earn proportional fees
   - Verify fees tracked correctly in Registry

10. Document Sepolia contract addresses

**Deliverable:**
- ✅ All contracts deployed to Sepolia
- ✅ 3+ relayers registered and active
- ✅ E2E flow working (deposit → relayer submission → balance update)
- ✅ Fee distribution functional
- ✅ Slashing mechanism tested

**Check-in (10:00 PM IST):**
Report: Sepolia deployment complete, E2E working, Day 10 targets

---

### DAY 10 — FEB 7 (Frontend — Relayer Dashboard)

**Goal:** Build relayer dashboard frontend

**Morning (9:00 AM - 1:00 PM):**
1. Create RelayerDashboard.tsx component
   ```typescript
   interface RelayerStats {
     relayerId: number;
     address: string;
     stake: bigint;
     active: boolean;
     totalSubmissions: number;
     failedSubmissions: number;
     earnings: bigint;
     successRate: number;
   }

   function RelayerDashboard() {
     const [relayers, setRelayers] = useState<RelayerStats[]>([]);
     const [userRelayerId, setUserRelayerId] = useState<number | null>(null);

     // Fetch active relayers from RelayerRegistry
     // Display table: ID | Address | Stake | Submissions | Success Rate | Earnings
     // Show "Register as Relayer" button if user not registered
     // Show "Unregister" button if user is active relayer
   }
   ```

2. Implement relayer registration flow
   - Input: Stake amount (default 1 BTC)
   - Button: "Register as Relayer"
   - Transaction: Call `register_relayer(stake)`
   - Success: Show relayer ID + "Registered successfully"

3. Implement relayer stats fetching
   - Read from RelayerRegistry: `get_relayer_info(relayer_id)`
   - Display: Stake, submissions, earnings, success rate
   - Auto-refresh every 10 seconds

**Afternoon (2:00 PM - 6:00 PM):**
4. Build relayer list table
   - Columns: ID | Address | Stake | Active | Submissions | Success Rate | Earnings
   - Sortable by earnings, success rate
   - Color coding: Green (active), Red (slashed/inactive)

5. Add relayer earnings visualization
   - Simple bar chart or number display
   - "Total Earnings: X BTC"
   - "Submissions Processed: Y"

6. Test frontend with Sepolia contracts
   - Connect wallet
   - Register as relayer
   - Verify stats update after processing submissions
   - Test unregister flow

**Evening (6:00 PM - 10:00 PM):**
7. Integrate relayer selection into main wallet view
   - When user clicks "Execute Contract", show selected relayer
   - Display: "Relayer #X will submit your proof (fee: 0.1%)"
   - Optional: Let user choose relayer (advanced feature)

8. Test full user flow with relayer dashboard
   - User deposits BTC
   - User executes contract
   - Relayer dashboard shows updated earnings
   - User balance reflects fee deduction

9. Polish dashboard UI (spacing, colors, responsive)

**Deliverable:**
- ✅ Relayer Dashboard page functional
- ✅ Registration/unregistration working
- ✅ Relayer stats displayed correctly
- ✅ E2E user flow tested with dashboard

**Check-in (10:00 PM IST):**
Report: Dashboard complete, E2E tested, Day 11 targets

---

### DAY 11 — FEB 8 (Final Testing + KILL SWITCH CHECKPOINT)

**Goal:** Comprehensive testing, bug fixes, GO/NO-GO decision

**Morning (9:00 AM - 1:00 PM):**
1. End-to-end testing checklist
   - [ ] 3+ relayers active on Sepolia
   - [ ] User deposit → relayer submission → balance update (working)
   - [ ] Fee deduction from user balance (correct amount)
   - [ ] Relayer earnings distribution (correct)
   - [ ] Slashing on failed submission (triggers correctly)
   - [ ] Round-robin selection (rotates properly)
   - [ ] Dashboard displays accurate stats
   - [ ] No breaking bugs in existing features

2. Test concurrent submissions
   - 2+ users execute contracts simultaneously
   - Verify: Correct relayer selection, no race conditions
   - Verify: Fees distributed correctly

3. Test relayer failover
   - Deactivate top relayer (slash to zero stake)
   - Verify: Coordinator selects next active relayer
   - Verify: System continues functioning

**Afternoon (2:00 PM - 6:00 PM):**
4. Bug fixing sprint
   - Fix any issues found in morning testing
   - Re-run full test suite
   - Ensure all critical paths working

5. Performance testing
   - Test with 5+ relayers active
   - Test with 10+ concurrent users
   - Verify gas costs reasonable

6. Code cleanup
   - Remove debug logs
   - Add comments to complex logic
   - Ensure code quality

**Evening (6:00 PM - 10:00 PM):**
7. **KILL SWITCH CHECKPOINT — GO/NO-GO DECISION**

**✅ GO (CONTINUE) IF:**
- 3+ relayers registered and active on Sepolia
- Proof submission routing through relayers works reliably
- Fee distribution functional and tested
- Slashing mechanism works (tested with failed submission)
- Dashboard shows accurate relayer stats
- No critical bugs in existing features
- Confidence level: 80%+ that this will demo well

**❌ NO-GO (CUT IT) IF:**
- Relayer coordination has unreliable behavior
- Fee distribution has bugs or edge cases breaking
- Slashing mechanism breaks proof submission flow
- Dashboard not functional or showing wrong data
- Existing features broken by integration
- Confidence level: <80% or major blockers remain

**IF NO-GO:**
1. Revert to single-relayer model (original implementation)
2. Add "Future Work: Decentralized Relayer Network" section to README
3. Move immediately to Phase 2 (E2E testing other flows)
4. No shame — you protected your working project

**IF GO:**
1. Commit all relayer network code
2. Tag release: `v2.0-relayer-network`
3. Update README with relayer network section
4. Proceed to Phase 2 with confidence

**Deliverable:**
- ✅ Full system tested and working OR clean revert to single-relayer
- ✅ GO/NO-GO decision made
- ✅ Code committed and tagged

**Check-in (10:00 PM IST):**
Report: GO/NO-GO decision, rationale, Day 12 targets

---

## PHASE 2: REMAINING FLOWS + POLISH (Days 12-14: Feb 9-11)

---

### DAY 12 — FEB 9 (E2E Testing: AMM + Predictions)

**Goal:** Test AMM and Prediction market flows end-to-end

**Morning (9:00 AM - 1:00 PM):**
1. **AMM Flow Testing**
   - Deploy test AMM contract if not already deployed
   - Test: Deposit BTC to shielded pool
   - Test: Execute swap via AMM (BTC → ETH)
   - Test: Withdraw ETH from pool
   - Verify: Relayer processes swap, fees deducted correctly
   - Verify: AMM state updated, balances correct

2. Fix any AMM integration issues
   - Ensure proof generation works for swap calldata
   - Ensure AMM contract callable via PrivatePool.execute()

**Afternoon (2:00 PM - 6:00 PM):**
3. **Prediction Market Flow Testing**
   - Deploy test Prediction contract if not already deployed
   - Test: Create prediction market
   - Test: Place bet from shielded balance
   - Test: Resolve market
   - Test: Claim winnings to shielded balance
   - Verify: Relayer processes bet, fees deducted correctly
   - Verify: Prediction contract state correct

4. Fix any Prediction market integration issues

**Evening (6:00 PM - 10:00 PM):**
5. Cross-feature testing
   - Test: AMM swap → Prediction bet → Withdraw (multi-step flow)
   - Verify: Balance tracking correct across multiple operations
   - Verify: Relayers earn fees from all operations

6. Document any remaining issues

**Deliverable:**
- ✅ AMM flow working end-to-end on Sepolia
- ✅ Prediction market flow working end-to-end on Sepolia
- ✅ Multi-step flows tested
- ✅ All features functional with relayer network

**Check-in (10:00 PM IST):**
Report: AMM + Predictions tested, Day 13 targets

---

### DAY 13 — FEB 10 (E2E Testing: Voting + Frontend Polish)

**Goal:** Test Voting flow, polish frontend

**Morning (9:00 AM - 1:00 PM):**
1. **Voting Flow Testing**
   - Deploy test Voting contract if not already deployed
   - Test: Create voting proposal
   - Test: Cast vote from shielded balance
   - Test: Tally votes
   - Verify: Relayer processes vote, fees deducted correctly
   - Verify: Voting contract state correct

2. Fix any Voting integration issues

**Afternoon (2:00 PM - 6:00 PM):**
3. **Frontend Polish — Error Handling**
   - Add error messages for failed transactions
   - Add loading states for all async operations
   - Add success notifications (deposit, execute, withdraw)
   - Add relayer selection display ("Processing via Relayer #X")

4. **Frontend Polish — Responsive Design**
   - Test on mobile (iPhone, Android)
   - Test on tablet (iPad)
   - Test on desktop (1920x1080, 1366x768)
   - Fix any layout issues

**Evening (6:00 PM - 10:00 PM):**
5. **Frontend Polish — Visual Quality**
   - Consistent spacing/padding
   - Color scheme polished
   - Buttons/inputs styled consistently
   - Loading spinners smooth
   - Transitions between states clean

6. **Accessibility Pass**
   - Ensure all buttons have labels
   - Ensure keyboard navigation works
   - Test with screen reader (basic)

**Deliverable:**
- ✅ Voting flow working end-to-end on Sepolia
- ✅ Frontend polished (error handling, responsive, visual quality)
- ✅ All UI states handled gracefully

**Check-in (10:00 PM IST):**
Report: Voting tested, frontend polished, Day 14 targets

---

### DAY 14 — FEB 11 (Final Testing + Bug Fixes)

**Goal:** Comprehensive final testing, fix all remaining bugs

**Morning (9:00 AM - 1:00 PM):**
1. **Cross-browser Testing**
   - Test on Chrome (latest)
   - Test on Firefox (latest)
   - Test on Safari (latest)
   - Document any browser-specific issues

2. Fix browser compatibility issues
   - Wallet connection (MetaMask, ArgentX, Braavos)
   - Proof generation (ensure works in all browsers)
   - UI rendering consistency

**Afternoon (2:00 PM - 6:00 PM):**
3. **Stress Testing**
   - Test with 5+ relayers active
   - Test with 10+ users depositing/executing
   - Monitor gas costs
   - Monitor transaction times

4. **Edge Case Testing**
   - User balance exactly equals tx + fee (should work)
   - User balance < tx + fee (should reject gracefully)
   - All relayers slashed/inactive (should show error)
   - Invalid proof submission (should reject, slash relayer)

**Evening (6:00 PM - 10:00 PM):**
5. **Final Bug Fixing**
   - Fix any issues found in testing
   - Re-test all critical paths
   - Ensure zero critical bugs

6. **Code Freeze**
   - Final commit: "Pre-submission code freeze"
   - Tag release: `v2.1-submission-ready`
   - No more feature changes after this point

**Deliverable:**
- ✅ All flows tested across browsers
- ✅ All bugs fixed
- ✅ Code frozen and tagged
- ✅ Production-ready system

**Check-in (10:00 PM IST):**
Report: Testing complete, bugs fixed, ready for video, Day 15 targets

---

## PHASE 3: VIDEO + SUBMISSION (Days 15-18: Feb 12-15)

---

### DAY 15 — FEB 12 (Video Recording)

**Goal:** Record high-quality demo video

**Morning (9:00 AM - 1:00 PM):**
1. **Script 60-Second Pitch**
   ```
   [0-15s] SETUP
   "Bitcoin on L2s is all public. Every DeFi transaction—swaps, bets, votes—visible to everyone. Front-running, MEV, zero privacy.

   I built Lisan: privacy DeFi infrastructure for Bitcoin on Starknet."

   [15-40s] DEMO
   "Here's my shielded Bitcoin wallet. Balance hidden via Merkle commitments.

   I'm calling this Counter contract privately. Proof generated locally. Relayer #2 selected from decentralized network. Proof submitted. Contract executed. Balance stays hidden. Relayer earns fee.

   This isn't Tornado Cash—that's just transfers. This is private EXECUTION. Any contract. Any protocol."

   [40-60s] PUNCHLINE
   "Decentralized relayer network with economic incentives. Relayers earn fees, get slashed for failures. Full DeFi composability with privacy guarantees.

   Bitcoin that can DO things, privately. Built on Starknet. Live on testnet."
   ```

2. Practice pitch 20x times
   - Time yourself (should be 55-60 seconds)
   - Smooth delivery, no stumbling
   - Record practice runs, review

**Afternoon (2:00 PM - 6:00 PM):**
3. **Record Demo Video (Multiple Takes)**
   - Take 1: Full script + demo
   - Take 2: Adjust pacing if needed
   - Take 3: Best take
   - Record B-roll: Wallet UI, relayer dashboard, contract execution

4. **Screen Recording Setup**
   - 1080p resolution minimum
   - Clear audio (use good mic)
   - Zoom in on important UI elements
   - Smooth mouse movements

**Evening (6:00 PM - 10:00 PM):**
5. **Video Editing (Basic)**
   - Cut dead air
   - Add text overlays (contract addresses, relayer IDs if needed)
   - Add smooth transitions between scenes
   - Ensure 60-second final length (or 2-3 min extended version)

6. **Export Video**
   - Format: MP4, H.264
   - Resolution: 1080p
   - Upload to YouTube (unlisted)

**Deliverable:**
- ✅ 60-second demo video recorded and edited
- ✅ Video uploaded to YouTube
- ✅ Practice pitch delivery smooth

**Check-in (10:00 PM IST):**
Report: Video complete, link ready, Day 16 targets

---

### DAY 16 — FEB 13 (Submission Materials — Dual Track)

**Goal:** Write dual-track submission materials

**Morning (9:00 AM - 1:00 PM):**
1. **README.md — Bitcoin Track Version**
   ```markdown
   # Lisan — Privacy DeFi Infrastructure for Bitcoin on Starknet

   ## Problem
   Bitcoin on L2s is all public. Every DeFi transaction (swaps, predictions, voting) is visible on-chain. Front-running, MEV, zero privacy.

   ## Solution
   Lisan is a shielded Bitcoin pool with full DeFi composability:
   - **Privacy:** Balance hidden via Merkle commitments, SNARK proofs for execution
   - **Composability:** Execute ANY Starknet smart contract privately
   - **Infrastructure:** Decentralized relayer network with economic incentives

   ## Why Bitcoin Track
   Starknet's BTCFi push focuses on making Bitcoin productive (staking, lending, DeFi). Lisan adds the missing layer: privacy. Bitcoin that can DO things, privately.

   ## Architecture
   - ShieldedPool: Merkle tree commitments, nullifier tracking
   - RelayerNetwork: Decentralized proof submission, fee incentives, slashing
   - CrossContract: Execute any Starknet contract from shielded balance

   ## Differentiation
   - **Tornado Cash:** Private transfers only
   - **Lisan:** Private execution + decentralized infrastructure

   ## Demo
   [Video link]

   ## Contracts (Sepolia)
   - PrivatePool: 0x...
   - RelayerRegistry: 0x...
   - RelayerCoordinator: 0x...

   ## Future Work
   - Stake-weighted relayer selection
   - Advanced anti-collusion mechanisms
   - Multi-asset support beyond Bitcoin
   ```

2. **README.md — Privacy Track Version**
   ```markdown
   # Lisan — ZK Execution Layer for Private DeFi on Starknet

   ## Problem
   Privacy tools like Tornado Cash only do transfers. No composability. No DeFi.

   ## Solution
   Lisan extends privacy to arbitrary contract execution:
   - **ZK Proofs:** SNARK verification for private state updates
   - **Composability:** Call any DeFi protocol from shielded balance
   - **Infrastructure:** Decentralized relayers preserve anonymity

   ## Why Privacy Track
   "Finding value in privacy apps" beyond transfers. Lisan shows privacy + full DeFi composability is possible.

   ## Privacy Architecture
   - Commitment scheme: BN254 Poseidon hashing
   - Merkle tree: Balance hiding without revealing commitments
   - Nullifiers: Double-spend prevention
   - Relayers: Anonymity-preserving proof submission

   ## Differentiation
   - **Existing privacy:** Transfers only (Tornado)
   - **Lisan:** Private execution primitives for full DeFi stack

   [Rest same as Bitcoin track version]
   ```

**Afternoon (2:00 PM - 6:00 PM):**
3. **Write ARCHITECTURE.md**
   - Detailed contract architecture
   - Flow diagrams (user → relayer → coordinator → pool → target contract)
   - Privacy guarantees explained
   - Relayer incentive model

4. **Write RELAYER_NETWORK.md**
   - How to become a relayer
   - Economic model (fees, slashing, stakes)
   - Selection algorithm
   - Anti-collusion design

**Evening (6:00 PM - 10:00 PM):**
5. **Polish All Documentation**
   - Fix typos
   - Add screenshots
   - Add contract addresses
   - Add video link
   - Ensure clarity

6. **Prepare DoraHacks Submission Form Fields**
   - Project name: "Lisan — Privacy DeFi Infrastructure for Bitcoin on Starknet"
   - One-liner: "Private Bitcoin wallet. Call any Starknet smart contract."
   - Description: [Use README Problem/Solution sections]
   - Demo link: YouTube video
   - GitHub link: Repo URL
   - Deployed contracts: List Sepolia addresses

**Deliverable:**
- ✅ Dual-track README versions written
- ✅ Architecture docs complete
- ✅ Submission form fields prepared
- ✅ All documentation polished

**Check-in (10:00 PM IST):**
Report: Documentation complete, ready to submit, Day 17 targets

---

### DAY 17 — FEB 14 (Final Review + Submission Prep)

**Goal:** Final review, prepare submission

**Morning (9:00 AM - 1:00 PM):**
1. **Final Repository Review**
   - README.md clear and compelling
   - All contracts documented
   - No sensitive data in repo (private keys, API keys)
   - Clean commit history

2. **Final Demo Video Review**
   - Re-watch video 3x times
   - Ensure clarity, pacing, impact
   - Verify YouTube link works (unlisted)

3. **Final Testing Pass**
   - Load website, ensure working
   - Connect wallet, deposit BTC
   - Execute contract via relayer
   - Verify dashboard updates
   - All flows working smoothly

**Afternoon (2:00 PM - 6:00 PM):**
4. **Screenshot/Visual Prep**
   - Take clean screenshots of:
     - Wallet interface (shielded balance)
     - Relayer dashboard (active relayers, earnings)
     - Contract execution (proof submission)
   - Use screenshots in README or submission

5. **Backup Plan**
   - Export all code to zip file (backup)
   - Document all Sepolia contract addresses
   - Save video locally (in case YouTube issue)

**Evening (6:00 PM - 10:00 PM):**
6. **Submission Checklist**
   - [ ] README.md (Bitcoin track version) finalized
   - [ ] README.md (Privacy track version) finalized
   - [ ] Video demo uploaded and link working
   - [ ] GitHub repo public and accessible
   - [ ] All Sepolia contracts deployed and verified
   - [ ] Submission form fields prepared
   - [ ] Screenshots ready
   - [ ] Everything double-checked

7. **Mental Preparation**
   - Review key talking points
   - Review Adrien/Richard/Teddy/Jonathan feedback
   - Confidence check: 90%+ ready to submit

**Deliverable:**
- ✅ Everything ready for submission
- ✅ Final checks complete
- ✅ Confidence level high

**Check-in (10:00 PM IST):**
Report: Ready to submit, Day 18 plan

---

### DAY 18 — FEB 15 (SUBMISSION DAY)

**Goal:** Submit to both tracks

**Morning (9:00 AM - 12:00 PM):**
1. **Submit to Bitcoin Track**
   - Go to DoraHacks RE{DEFINE} hackathon page
   - Fill submission form (Bitcoin track)
   - Upload all materials
   - Double-check all links work
   - Submit ✅

2. **Verify Bitcoin Track Submission**
   - Check submission appears on DoraHacks
   - Test all links in submission
   - Ensure video plays

**Afternoon (12:00 PM - 3:00 PM):**
3. **Submit to Privacy Track**
   - Fill submission form (Privacy track)
   - Use Privacy track README version
   - Upload all materials
   - Double-check all links work
   - Submit ✅

4. **Verify Privacy Track Submission**
   - Check submission appears on DoraHacks
   - Test all links in submission
   - Ensure video plays

**Evening (3:00 PM - 6:00 PM):**
5. **Post-Submission Actions**
   - Tweet about submission (tag @Starknet, @DoraHacks)
   - Share in Starknet Discord
   - Thank mentors (Adrien, Richard, Teddy, Jonathan)

6. **Relax**
   - You built a decentralized relayer network in 6 days
   - You shipped to both tracks
   - You have validation from Bitcoin Lead + Foundation
   - You did the work

**Deliverable:**
- ✅ SUBMITTED TO BOTH TRACKS ✅
- ✅ Dual validation secured
- ✅ Relayer network live
- ✅ Everything shipped

**Final Check-in (6:00 PM IST):**
Report: SUBMITTED. Victory lap.

---

## DAYS 19-20 (FEB 16-20): BUFFER

**Use for:**
- Any last-minute fixes if judges ask questions
- Respond to DoraHacks comments
- Additional polish if time allows
- Rest and celebrate

---

## DAILY CHECK-IN FORMAT (Mandatory at 10:00 PM IST)

**Report Template:**
```
DAY X CHECK-IN (Feb X)

✅ COMPLETED TODAY:
- [Task 1]
- [Task 2]
- [Task 3]

🚧 IN PROGRESS:
- [Task if not finished]

🔴 BLOCKERS:
- [Any issues blocking progress]

📊 METRICS:
- Tests passing: X/Y
- Contracts deployed: X/Y
- Features working: X/Y

🎯 TOMORROW'S TARGET:
- [Day X+1 goals]

🟢/🟡/🔴 ON TRACK FOR DAY 11 CHECKPOINT:
- [YES/NO + reason]

💭 NOTES:
- [Anything else to mention]
```

**IF YOU MISS CHECK-IN:** I assume you're behind and may call kill switch.

---

## KILL SWITCH CRITERIA (Day 11 — Feb 8 EOD)

### ✅ CONTINUE IF:
- 3+ relayers registered and active on Sepolia
- Proof submission routing through relayers works reliably
- Fee distribution functional and tested
- Slashing mechanism works (tested with failed submission)
- Dashboard shows accurate relayer stats
- No critical bugs in existing features
- **Confidence: 80%+ this will demo well**

### ❌ CUT IF:
- Relayer coordination unreliable
- Fee distribution buggy
- Slashing breaks proof flow
- Dashboard non-functional
- Existing features broken
- **Confidence: <80% or major blockers**

**IF CUT:**
1. Revert to single-relayer
2. Add "Future Work" section to README
3. Move to Phase 2 immediately
4. No shame—protected working project

---

## SUCCESS METRICS

**By Feb 8 (Day 11 Kill Switch):**
- Relayer network functional on Sepolia
- E2E flow tested: deposit → relayer submission → balance update
- Dashboard showing relayer stats

**By Feb 15 (Day 18 Submission):**
- Dual-track submission complete
- Video demo polished
- All features working smoothly
- Relayer network live and impressive

**By Feb 20 (Deadline):**
- SUBMITTED ✅
- Buffer for any judge questions
- Ready for evaluation

---

## CONTACT

**Daily check-ins:** 10:00 PM IST
**Emergency contact:** If you're blocked, message me anytime
**Kill switch authority:** I call it if you're behind on Day 11

---

**LET'S BUILD. 18 DAYS. DECENTRALIZED RELAYER NETWORK. DUAL-TRACK SUBMISSION. GO.**
