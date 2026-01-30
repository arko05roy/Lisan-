/// Interface for Garaga-generated Groth16 BN254 verifier contracts.
/// Each verifier is deployed as a standalone contract; our contracts call them
/// via this dispatcher interface.
///
/// The verifier contracts live in circuits/build/<circuit>_verifier/ and are
/// deployed separately. Their addresses are stored in each contract's storage.

#[starknet::interface]
pub trait IGroth16VerifierBN254<TContractState> {
    /// Verify a Groth16 proof on BN254.
    /// full_proof_with_hints: serialized proof + public inputs + MSM/pairing hints
    ///   (generated client-side by garaga npm package's getGroth16CallData)
    /// Returns Ok(public_inputs) as Span<u256> if valid, Err(error) otherwise.
    fn verify_groth16_proof_bn254(
        self: @TContractState, full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}
