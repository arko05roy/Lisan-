use lisan_contracts::bn254_poseidon::{
    bn254_poseidon_hash_1, bn254_poseidon_hash_3, bn254_poseidon_hash_4,
};

/// Compute a BN254 Poseidon commitment from amount, secret, and nullifier_secret.
/// commitment = Poseidon(amount, secret, nullifier_secret)
pub fn compute_commitment(amount: felt252, secret: felt252, nullifier_secret: felt252) -> felt252 {
    bn254_poseidon_hash_3(amount, secret, nullifier_secret)
}

/// Compute the nullifier hash from the nullifier_secret.
/// nullifier_hash = Poseidon(nullifier_secret)
pub fn compute_nullifier_hash(nullifier_secret: felt252) -> felt252 {
    bn254_poseidon_hash_1(nullifier_secret)
}

/// Verify that a commitment matches the given inputs.
pub fn verify_commitment(
    commitment: felt252, amount: felt252, secret: felt252, nullifier_secret: felt252,
) -> bool {
    commitment == compute_commitment(amount, secret, nullifier_secret)
}

/// Compute a BN254 Poseidon commitment for multi-asset pool.
/// commitment = Poseidon(amount, token_address, secret, nullifier_secret)
pub fn compute_pool_commitment(
    amount: felt252, token_address: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    bn254_poseidon_hash_4(amount, token_address, secret, nullifier_secret)
}

/// Verify that a pool commitment matches the given inputs.
pub fn verify_pool_commitment(
    commitment: felt252,
    amount: felt252,
    token_address: felt252,
    secret: felt252,
    nullifier_secret: felt252,
) -> bool {
    commitment == compute_pool_commitment(amount, token_address, secret, nullifier_secret)
}

/// Compute a BN254 Poseidon commitment for AMM with token type.
/// commitment = Poseidon(amount, token_type, secret, nullifier_secret)
pub fn compute_amm_commitment(
    amount: felt252, token_type: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    bn254_poseidon_hash_4(amount, token_type, secret, nullifier_secret)
}

/// Verify that an AMM commitment matches the given inputs.
pub fn verify_amm_commitment(
    commitment: felt252,
    amount: felt252,
    token_type: felt252,
    secret: felt252,
    nullifier_secret: felt252,
) -> bool {
    commitment == compute_amm_commitment(amount, token_type, secret, nullifier_secret)
}

/// Compute a BN254 Poseidon commitment for a prediction market bet.
/// commitment = Poseidon(outcome, amount, secret, nullifier_secret)
pub fn compute_bet_commitment(
    outcome: felt252, amount: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    bn254_poseidon_hash_4(outcome, amount, secret, nullifier_secret)
}

/// Verify that a bet commitment matches the given inputs.
pub fn verify_bet_commitment(
    commitment: felt252,
    outcome: felt252,
    amount: felt252,
    secret: felt252,
    nullifier_secret: felt252,
) -> bool {
    commitment == compute_bet_commitment(outcome, amount, secret, nullifier_secret)
}

/// Compute a BN254 Poseidon commitment for a private vote.
/// commitment = Poseidon(choice, secret, nullifier_secret)
pub fn compute_vote_commitment(
    choice: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    bn254_poseidon_hash_3(choice, secret, nullifier_secret)
}

/// Verify that a vote commitment matches the given inputs.
pub fn verify_vote_commitment(
    commitment: felt252, choice: felt252, secret: felt252, nullifier_secret: felt252,
) -> bool {
    commitment == compute_vote_commitment(choice, secret, nullifier_secret)
}
