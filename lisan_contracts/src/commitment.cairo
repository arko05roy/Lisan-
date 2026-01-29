use core::poseidon::PoseidonTrait;
use core::hash::HashStateTrait;

/// Compute a Poseidon commitment from amount, secret, and nullifier_secret.
/// commitment = Poseidon(amount, secret, nullifier_secret)
pub fn compute_commitment(amount: felt252, secret: felt252, nullifier_secret: felt252) -> felt252 {
    PoseidonTrait::new().update(amount).update(secret).update(nullifier_secret).finalize()
}

/// Compute the nullifier hash from the nullifier_secret.
/// nullifier_hash = Poseidon(nullifier_secret)
pub fn compute_nullifier_hash(nullifier_secret: felt252) -> felt252 {
    PoseidonTrait::new().update(nullifier_secret).finalize()
}

/// Verify that a commitment matches the given inputs.
pub fn verify_commitment(
    commitment: felt252, amount: felt252, secret: felt252, nullifier_secret: felt252,
) -> bool {
    commitment == compute_commitment(amount, secret, nullifier_secret)
}

/// Compute a Poseidon commitment for AMM with token type.
/// commitment = Poseidon(amount, token_type, secret, nullifier_secret)
pub fn compute_amm_commitment(
    amount: felt252, token_type: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    PoseidonTrait::new()
        .update(amount)
        .update(token_type)
        .update(secret)
        .update(nullifier_secret)
        .finalize()
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

/// Compute a Poseidon commitment for a prediction market bet.
/// commitment = Poseidon(outcome, amount, secret, nullifier_secret)
pub fn compute_bet_commitment(
    outcome: felt252, amount: felt252, secret: felt252, nullifier_secret: felt252,
) -> felt252 {
    PoseidonTrait::new()
        .update(outcome)
        .update(amount)
        .update(secret)
        .update(nullifier_secret)
        .finalize()
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
