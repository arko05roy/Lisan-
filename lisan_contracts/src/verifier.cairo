use lisan_contracts::garaga_verifiers::{
    IGroth16VerifierBN254Dispatcher, IGroth16VerifierBN254DispatcherTrait,
};
use starknet::ContractAddress;

/// Call a deployed Garaga Groth16 verifier and return the verified public inputs.
/// Panics if the proof is invalid.
fn call_verifier(
    verifier_address: ContractAddress, full_proof_with_hints: Span<felt252>,
) -> Span<u256> {
    let verifier = IGroth16VerifierBN254Dispatcher { contract_address: verifier_address };
    let result = verifier.verify_groth16_proof_bn254(full_proof_with_hints);
    match result {
        Result::Ok(public_inputs) => public_inputs,
        Result::Err(_) => panic!("Groth16 proof verification failed"),
    }
}

/// Verify pool withdraw proof and check public inputs match expected values.
/// Expected public inputs (as u256): [root, nullifierHash, tokenAddress, withdrawAmount]
pub fn verify_pool_withdraw(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_root: felt252,
    expected_nullifier_hash: felt252,
    expected_token_address: felt252,
    expected_withdraw_amount: felt252,
) {
    let public_inputs = call_verifier(verifier_address, full_proof_with_hints);
    assert(public_inputs.len() == 4, 'Wrong number of public inputs');

    let root_u256: u256 = expected_root.into();
    let nullifier_u256: u256 = expected_nullifier_hash.into();
    let token_u256: u256 = expected_token_address.into();
    let amount_u256: u256 = expected_withdraw_amount.into();

    assert(*public_inputs.at(0) == root_u256, 'Root mismatch');
    assert(*public_inputs.at(1) == nullifier_u256, 'Nullifier mismatch');
    assert(*public_inputs.at(2) == token_u256, 'Token address mismatch');
    assert(*public_inputs.at(3) == amount_u256, 'Withdraw amount mismatch');
}

/// Verify pool execute proof and check public inputs match expected values.
/// Reuses the same circuit as pool withdraw — public inputs: [root, nullifierHash, tokenAddress, totalAmount]
pub fn verify_pool_execute(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_root: felt252,
    expected_nullifier_hash: felt252,
    expected_token_address: felt252,
    expected_total_amount: felt252,
) {
    // Same verification as withdraw — the circuit proves ownership of a commitment
    verify_pool_withdraw(
        verifier_address,
        full_proof_with_hints,
        expected_root,
        expected_nullifier_hash,
        expected_token_address,
        expected_total_amount,
    );
}

/// Verify pool transfer proof and check public inputs match expected values.
/// Expected public inputs (as u256): [root, nullifierHash, newCommSender, newCommRecipient]
pub fn verify_pool_transfer(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_root: felt252,
    expected_nullifier_hash: felt252,
    expected_new_comm_sender: felt252,
    expected_new_comm_recipient: felt252,
) {
    let public_inputs = call_verifier(verifier_address, full_proof_with_hints);
    assert(public_inputs.len() == 4, 'Wrong number of public inputs');

    let root_u256: u256 = expected_root.into();
    let nullifier_u256: u256 = expected_nullifier_hash.into();
    let comm_sender_u256: u256 = expected_new_comm_sender.into();
    let comm_recipient_u256: u256 = expected_new_comm_recipient.into();

    assert(*public_inputs.at(0) == root_u256, 'Root mismatch');
    assert(*public_inputs.at(1) == nullifier_u256, 'Nullifier mismatch');
    assert(*public_inputs.at(2) == comm_sender_u256, 'Sender commitment mismatch');
    assert(*public_inputs.at(3) == comm_recipient_u256, 'Recipient commitment mismatch');
}

/// Verify AMM withdraw proof and check public inputs match expected values.
/// Expected public inputs (as u256): [root, nullifierHash, tokenType, withdrawAmount]
pub fn verify_amm_withdraw(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_root: felt252,
    expected_nullifier_hash: felt252,
    expected_token_type: felt252,
    expected_withdraw_amount: felt252,
) {
    let public_inputs = call_verifier(verifier_address, full_proof_with_hints);
    assert(public_inputs.len() == 4, 'Wrong number of public inputs');

    let root_u256: u256 = expected_root.into();
    let nullifier_u256: u256 = expected_nullifier_hash.into();
    let token_u256: u256 = expected_token_type.into();
    let amount_u256: u256 = expected_withdraw_amount.into();

    assert(*public_inputs.at(0) == root_u256, 'Root mismatch');
    assert(*public_inputs.at(1) == nullifier_u256, 'Nullifier mismatch');
    assert(*public_inputs.at(2) == token_u256, 'Token type mismatch');
    assert(*public_inputs.at(3) == amount_u256, 'Withdraw amount mismatch');
}

/// Verify AMM swap proof and check public inputs match expected values.
/// Expected public inputs (as u256): [root, nullifierHash, tokenTypeIn, amountIn,
///   tokenTypeOut, newCommitment, amountOut]
pub fn verify_amm_swap(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_root: felt252,
    expected_nullifier_hash: felt252,
    expected_token_type_in: felt252,
    expected_amount_in: felt252,
    expected_token_type_out: felt252,
    expected_new_commitment: felt252,
    expected_amount_out: felt252,
) {
    let public_inputs = call_verifier(verifier_address, full_proof_with_hints);
    assert(public_inputs.len() == 7, 'Wrong number of public inputs');

    let root_u256: u256 = expected_root.into();
    let nullifier_u256: u256 = expected_nullifier_hash.into();
    let type_in_u256: u256 = expected_token_type_in.into();
    let amt_in_u256: u256 = expected_amount_in.into();
    let type_out_u256: u256 = expected_token_type_out.into();
    let comm_u256: u256 = expected_new_commitment.into();
    let amt_out_u256: u256 = expected_amount_out.into();

    assert(*public_inputs.at(0) == root_u256, 'Root mismatch');
    assert(*public_inputs.at(1) == nullifier_u256, 'Nullifier mismatch');
    assert(*public_inputs.at(2) == type_in_u256, 'Token type in mismatch');
    assert(*public_inputs.at(3) == amt_in_u256, 'Amount in mismatch');
    assert(*public_inputs.at(4) == type_out_u256, 'Token type out mismatch');
    assert(*public_inputs.at(5) == comm_u256, 'New commitment mismatch');
    assert(*public_inputs.at(6) == amt_out_u256, 'Amount out mismatch');
}

/// Verify bet claim proof and check public inputs match expected values.
/// Expected public inputs (as u256): [betCommitment, nullifierHash, winningOutcome]
pub fn verify_bet_claim(
    verifier_address: ContractAddress,
    full_proof_with_hints: Span<felt252>,
    expected_bet_commitment: felt252,
    expected_nullifier_hash: felt252,
    expected_winning_outcome: felt252,
) {
    let public_inputs = call_verifier(verifier_address, full_proof_with_hints);
    assert(public_inputs.len() == 3, 'Wrong number of public inputs');

    let commitment_u256: u256 = expected_bet_commitment.into();
    let nullifier_u256: u256 = expected_nullifier_hash.into();
    let outcome_u256: u256 = expected_winning_outcome.into();

    assert(*public_inputs.at(0) == commitment_u256, 'Bet commitment mismatch');
    assert(*public_inputs.at(1) == nullifier_u256, 'Nullifier mismatch');
    assert(*public_inputs.at(2) == outcome_u256, 'Winning outcome mismatch');
}
