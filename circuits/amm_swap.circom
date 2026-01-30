pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";
include "./merkle/merkle_tree.circom";

// AMM swap circuit
// Proves: old commitment (amountIn, tokenTypeIn) is in the tree,
// nullifier is valid, and new commitment is correctly formed with (amountOut, tokenTypeOut).
// amountIn, amountOut are public so the contract can verify AMM pricing.
template AmmSwap(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input tokenTypeIn;
    signal input amountIn;
    signal input tokenTypeOut;
    signal input newCommitment;
    signal input amountOut;

    // Private inputs
    signal input oldSecret;
    signal input oldNullifierSecret;
    signal input newSecret;
    signal input newNullifierSecret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Compute old commitment = Poseidon(amountIn, tokenTypeIn, oldSecret, oldNullifierSecret)
    component oldCommitmentHasher = Poseidon(4);
    oldCommitmentHasher.inputs[0] <== amountIn;
    oldCommitmentHasher.inputs[1] <== tokenTypeIn;
    oldCommitmentHasher.inputs[2] <== oldSecret;
    oldCommitmentHasher.inputs[3] <== oldNullifierSecret;

    // 2. Verify old commitment in Merkle tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== oldCommitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 3. Verify nullifier hash = Poseidon(oldNullifierSecret)
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== oldNullifierSecret;
    nullifierHash === nullifierHasher.out;

    // 4. Verify amounts > 0
    component isZeroIn = IsZero();
    isZeroIn.in <== amountIn;
    isZeroIn.out === 0;

    component isZeroOut = IsZero();
    isZeroOut.in <== amountOut;
    isZeroOut.out === 0;

    // 5. Token types must be different
    component tokenEqual = IsEqual();
    tokenEqual.in[0] <== tokenTypeIn;
    tokenEqual.in[1] <== tokenTypeOut;
    tokenEqual.out === 0;

    // 6. Verify new commitment = Poseidon(amountOut, tokenTypeOut, newSecret, newNullifierSecret)
    component newCommitmentHasher = Poseidon(4);
    newCommitmentHasher.inputs[0] <== amountOut;
    newCommitmentHasher.inputs[1] <== tokenTypeOut;
    newCommitmentHasher.inputs[2] <== newSecret;
    newCommitmentHasher.inputs[3] <== newNullifierSecret;
    newCommitment === newCommitmentHasher.out;
}

component main {public [root, nullifierHash, tokenTypeIn, amountIn, tokenTypeOut, newCommitment, amountOut]} = AmmSwap(20);
