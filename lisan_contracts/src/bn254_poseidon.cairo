/// BN254-field Poseidon hash implementation.
///
/// This module provides Poseidon hashing over the BN254 scalar field,
/// matching the circomlib Poseidon used in the ZK circuits.
///
/// For production, this should use Garaga's modular arithmetic builtins
/// for efficient BN254 field operations. This implementation provides
/// the interface and uses Cairo's native Poseidon as a development placeholder.
use core::poseidon::PoseidonTrait;
use core::hash::HashStateTrait;

/// Zero value used as the initial leaf in the Merkle tree.
/// This is a domain separator value. Must be consistent between
/// on-chain tree and client-side tree reconstruction.
pub const ZERO_VALUE: felt252 =
    149573504042682935034498956990981497856992830401657690228951078079877741476;

/// Compute BN254 Poseidon hash of 2 inputs (for Merkle tree hashing).
///
/// NOTE: In production, this must perform Poseidon over BN254 scalar field
/// using Garaga field operations. Currently uses Cairo's native Poseidon
/// as a development placeholder.
pub fn bn254_poseidon_hash_2(left: felt252, right: felt252) -> felt252 {
    PoseidonTrait::new().update(left).update(right).finalize()
}

/// Compute BN254 Poseidon hash of 1 input (for nullifier hashing).
pub fn bn254_poseidon_hash_1(input: felt252) -> felt252 {
    PoseidonTrait::new().update(input).finalize()
}

/// Compute BN254 Poseidon hash of 3 inputs (for pool commitments).
/// commitment = Poseidon(amount, secret, nullifier_secret)
pub fn bn254_poseidon_hash_3(a: felt252, b: felt252, c: felt252) -> felt252 {
    PoseidonTrait::new().update(a).update(b).update(c).finalize()
}

/// Compute BN254 Poseidon hash of 4 inputs (for AMM/bet commitments).
/// commitment = Poseidon(a, b, c, d)
pub fn bn254_poseidon_hash_4(a: felt252, b: felt252, c: felt252, d: felt252) -> felt252 {
    PoseidonTrait::new().update(a).update(b).update(c).update(d).finalize()
}
