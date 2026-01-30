pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";

// Bet claim circuit (no Merkle tree - bet_commitment is already public)
// Proves: commitment matches private inputs, nullifier is valid,
// outcome matches the winning outcome, and amount > 0.
template BetClaim() {
    // Public inputs
    signal input betCommitment;
    signal input nullifierHash;
    signal input winningOutcome;

    // Private inputs
    signal input outcome;
    signal input amount;
    signal input secret;
    signal input nullifierSecret;

    // 1. Compute commitment = Poseidon(outcome, amount, secret, nullifierSecret)
    component commitmentHasher = Poseidon(4);
    commitmentHasher.inputs[0] <== outcome;
    commitmentHasher.inputs[1] <== amount;
    commitmentHasher.inputs[2] <== secret;
    commitmentHasher.inputs[3] <== nullifierSecret;
    betCommitment === commitmentHasher.out;

    // 2. Verify nullifier hash = Poseidon(nullifierSecret)
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifierSecret;
    nullifierHash === nullifierHasher.out;

    // 3. Outcome must match winning outcome
    outcome === winningOutcome;

    // 4. Amount > 0
    component isZero = IsZero();
    isZero.in <== amount;
    isZero.out === 0;
}

component main {public [betCommitment, nullifierHash, winningOutcome]} = BetClaim();
