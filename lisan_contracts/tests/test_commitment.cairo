use lisan_contracts::commitment::{compute_commitment, compute_nullifier_hash, verify_commitment};

#[test]
fn test_deterministic_hashing() {
    let amount: felt252 = 1000;
    let secret: felt252 = 42;
    let nullifier_secret: felt252 = 99;

    let c1 = compute_commitment(amount, secret, nullifier_secret);
    let c2 = compute_commitment(amount, secret, nullifier_secret);
    assert!(c1 == c2, "Commitment should be deterministic");
}

#[test]
fn test_different_inputs_different_hashes() {
    let c1 = compute_commitment(1000, 42, 99);
    let c2 = compute_commitment(1001, 42, 99);
    let c3 = compute_commitment(1000, 43, 99);
    let c4 = compute_commitment(1000, 42, 100);

    assert!(c1 != c2, "Different amount should give different hash");
    assert!(c1 != c3, "Different secret should give different hash");
    assert!(c1 != c4, "Different nullifier should give different hash");
}

#[test]
fn test_nullifier_hash_deterministic() {
    let h1 = compute_nullifier_hash(99);
    let h2 = compute_nullifier_hash(99);
    assert!(h1 == h2, "Nullifier hash should be deterministic");
}

#[test]
fn test_different_nullifier_secrets_different_hashes() {
    let h1 = compute_nullifier_hash(99);
    let h2 = compute_nullifier_hash(100);
    assert!(h1 != h2, "Different secrets should give different hashes");
}

#[test]
fn test_verify_commitment_valid() {
    let amount: felt252 = 1000;
    let secret: felt252 = 42;
    let nullifier_secret: felt252 = 99;

    let commitment = compute_commitment(amount, secret, nullifier_secret);
    assert!(verify_commitment(commitment, amount, secret, nullifier_secret), "Should verify");
}

#[test]
fn test_verify_commitment_invalid() {
    let commitment = compute_commitment(1000, 42, 99);
    assert!(!verify_commitment(commitment, 999, 42, 99), "Wrong amount should fail");
    assert!(!verify_commitment(commitment, 1000, 41, 99), "Wrong secret should fail");
    assert!(!verify_commitment(commitment, 1000, 42, 98), "Wrong nullifier should fail");
}
