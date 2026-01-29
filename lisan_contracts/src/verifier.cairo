use lisan_contracts::commitment::{compute_commitment, compute_nullifier_hash};

/// Verify all transfer constraints.
/// Returns true if all constraints pass.
pub fn verify_transfer_proof(
    // Old commitment inputs
    old_commitment: felt252,
    old_amount: felt252,
    old_secret: felt252,
    old_nullifier_secret: felt252,
    // Nullifier
    nullifier_hash: felt252,
    // New commitments
    new_commitment_sender: felt252,
    new_commitment_recipient: felt252,
    // Amounts
    change_amount: felt252,
    transfer_amount: felt252,
    // New secrets
    new_secret_sender: felt252,
    new_nullifier_secret_sender: felt252,
    new_secret_recipient: felt252,
    new_nullifier_secret_recipient: felt252,
) -> bool {
    // Constraint 1: Old commitment hash matches private inputs
    let computed_old = compute_commitment(old_amount, old_secret, old_nullifier_secret);
    if computed_old != old_commitment {
        return false;
    }

    // Constraint 2: Nullifier hash matches nullifier_secret
    let computed_nullifier = compute_nullifier_hash(old_nullifier_secret);
    if computed_nullifier != nullifier_hash {
        return false;
    }

    // Constraint 3: Value conservation (old_amount == change + transfer)
    // We work with felt252; addition is modular but for our domain amounts are small
    if old_amount != change_amount + transfer_amount {
        return false;
    }

    // Constraint 4: Transfer amount > 0
    if transfer_amount == 0 {
        return false;
    }

    // Constraint 5: New sender commitment correctly formed
    let computed_sender = compute_commitment(
        change_amount, new_secret_sender, new_nullifier_secret_sender,
    );
    if computed_sender != new_commitment_sender {
        return false;
    }

    // Constraint 6: New recipient commitment correctly formed
    let computed_recipient = compute_commitment(
        transfer_amount, new_secret_recipient, new_nullifier_secret_recipient,
    );
    if computed_recipient != new_commitment_recipient {
        return false;
    }

    true
}

/// Verify all withdraw constraints.
/// Returns true if all constraints pass.
pub fn verify_withdraw_proof(
    commitment: felt252,
    amount: felt252,
    secret: felt252,
    nullifier_secret: felt252,
    nullifier_hash: felt252,
    withdraw_amount: felt252,
) -> bool {
    // Constraint 1: Commitment hash matches private inputs
    let computed = compute_commitment(amount, secret, nullifier_secret);
    if computed != commitment {
        return false;
    }

    // Constraint 2: Nullifier hash matches nullifier_secret
    let computed_nullifier = compute_nullifier_hash(nullifier_secret);
    if computed_nullifier != nullifier_hash {
        return false;
    }

    // Constraint 3: Withdraw amount equals commitment amount (full withdraw)
    if withdraw_amount != amount {
        return false;
    }

    // Constraint 4: Withdraw amount > 0
    if withdraw_amount == 0 {
        return false;
    }

    true
}
