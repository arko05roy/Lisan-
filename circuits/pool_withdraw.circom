pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./merkle/merkle_tree.circom";

// Pool withdrawal circuit
// Proves: commitment is in the Merkle tree, nullifier is correctly derived,
// and withdraw amount equals the committed amount.
// Secrets never leave the client.
template PoolWithdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input withdrawAmount;

    // Private inputs
    signal input amount;
    signal input secret;
    signal input nullifierSecret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Compute commitment = Poseidon(amount, secret, nullifierSecret)
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== amount;
    commitmentHasher.inputs[1] <== secret;
    commitmentHasher.inputs[2] <== nullifierSecret;

    // 2. Verify Merkle inclusion
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitmentHasher.out;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 3. Verify nullifier hash = Poseidon(nullifierSecret)
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifierSecret;
    nullifierHash === nullifierHasher.out;

    // 4. Verify withdraw amount equals committed amount
    amount === withdrawAmount;
}

component main {public [root, nullifierHash, withdrawAmount]} = PoolWithdraw(20);
