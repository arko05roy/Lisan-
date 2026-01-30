/// Mock Groth16 verifier for demo/testing.
/// Implements the same IGroth16VerifierBN254 interface as the real Garaga verifiers
/// but skips actual proof verification — always returns Ok(public_inputs).
///
/// DO NOT use in production. Replace with garaga-generated verifiers.

#[starknet::contract]
pub mod MockGroth16Verifier {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use lisan_contracts::garaga_verifiers::IGroth16VerifierBN254;

    #[storage]
    struct Storage {
        /// Number of public inputs this verifier expects.
        n_public_inputs: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, n_public_inputs: u32) {
        self.n_public_inputs.write(n_public_inputs);
    }

    #[abi(embed_v0)]
    impl MockVerifier of IGroth16VerifierBN254<ContractState> {
        fn verify_groth16_proof_bn254(
            self: @ContractState, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252> {
            // Extract public inputs from the beginning of the calldata.
            // In the real Garaga verifier, these are embedded in the serialized proof.
            // For the mock, we expect them as the first N felt252 values.
            let n = self.n_public_inputs.read();
            assert(full_proof_with_hints.len() >= n, 'Not enough calldata');

            let mut public_inputs: Array<u256> = array![];
            let mut i: u32 = 0;
            while i < n {
                let val: u256 = (*full_proof_with_hints.at(i)).into();
                public_inputs.append(val);
                i += 1;
            };

            Result::Ok(public_inputs.span())
        }
    }
}
