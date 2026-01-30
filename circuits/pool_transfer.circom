pragma circom 2.0.0;

include "./node_modules/circomlib/circuits/poseidon.circom";
include "./node_modules/circomlib/circuits/comparators.circom";
include "./merkle/merkle_tree.circom";

// Pool transfer circuit
// Proves: old commitment is in the tree, nullifier is valid,
// value conservation holds, and new commitments are correctly formed.
template PoolTransfer(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input newCommitmentSender;
    signal input newCommitmentRecipient;

    // Private inputs
    signal input oldAmount;
    signal input oldSecret;
    signal input oldNullifierSecret;
    signal input changeAmount;
    signal input transferAmount;
    signal input newSecretSender;
    signal input newNullifierSecretSender;
    signal input newSecretRecipient;
    signal input newNullifierSecretRecipient;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Compute old commitment = Poseidon(oldAmount, oldSecret, oldNullifierSecret)
    component oldCommitmentHasher = Poseidon(3);
    oldCommitmentHasher.inputs[0] <== oldAmount;
    oldCommitmentHasher.inputs[1] <== oldSecret;
    oldCommitmentHasher.inputs[2] <== oldNullifierSecret;

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

    // 4. Value conservation: oldAmount == changeAmount + transferAmount
    oldAmount === changeAmount + transferAmount;

    // 5. Transfer amount > 0
    component isZero = IsZero();
    isZero.in <== transferAmount;
    isZero.out === 0;

    // 6. New sender commitment = Poseidon(changeAmount, newSecretSender, newNullifierSecretSender)
    component senderCommitmentHasher = Poseidon(3);
    senderCommitmentHasher.inputs[0] <== changeAmount;
    senderCommitmentHasher.inputs[1] <== newSecretSender;
    senderCommitmentHasher.inputs[2] <== newNullifierSecretSender;
    newCommitmentSender === senderCommitmentHasher.out;

    // 7. New recipient commitment = Poseidon(transferAmount, newSecretRecipient, newNullifierSecretRecipient)
    component recipientCommitmentHasher = Poseidon(3);
    recipientCommitmentHasher.inputs[0] <== transferAmount;
    recipientCommitmentHasher.inputs[1] <== newSecretRecipient;
    recipientCommitmentHasher.inputs[2] <== newNullifierSecretRecipient;
    newCommitmentRecipient === recipientCommitmentHasher.out;
}

component main {public [root, nullifierHash, newCommitmentSender, newCommitmentRecipient]} = PoolTransfer(20);
