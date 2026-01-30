/// Incremental Poseidon Merkle tree (depth 20, BN254 Poseidon).
///
/// Stores commitments as leaves and maintains a root history so that
/// proofs generated against a recent root remain valid even after new insertions.
///
/// Based on the Tornado Cash / Semaphore Merkle tree design.

/// Depth of the Merkle tree. Supports up to 2^20 = 1,048,576 leaves.
pub const TREE_LEVELS: u32 = 20;

/// Number of recent roots to store. Proofs against any of the last 30 roots are valid.
pub const ROOT_HISTORY_SIZE: u32 = 30;

#[starknet::interface]
pub trait IMerkleTree<TContractState> {
    fn insert_leaf(ref self: TContractState, leaf: felt252) -> u32;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
    fn get_last_root(self: @TContractState) -> felt252;
}

#[starknet::component]
pub mod MerkleTreeComponent {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::{TREE_LEVELS, ROOT_HISTORY_SIZE};
    use lisan_contracts::bn254_poseidon::{bn254_poseidon_hash_2, ZERO_VALUE};

    #[storage]
    pub struct Storage {
        /// Index of the next leaf to insert.
        next_index: u32,
        /// Current root history write index (wraps around ROOT_HISTORY_SIZE).
        current_root_index: u32,
        /// Filled subtree hashes at each level. Updated on each insertion.
        filled_subtrees: Map<u32, felt252>,
        /// Ring buffer of recent roots.
        roots: Map<u32, felt252>,
        /// Precomputed zero hashes at each level.
        zeros: Map<u32, felt252>,
        /// Whether the tree has been initialized.
        initialized: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>,
    > of InternalTrait<TContractState> {
        /// Initialize the tree by precomputing zero hashes.
        /// Must be called once before any insertions.
        fn initialize(ref self: ComponentState<TContractState>) {
            assert(!self.initialized.read(), 'Tree already initialized');

            // zeros[0] = ZERO_VALUE (the empty leaf)
            self.zeros.write(0, ZERO_VALUE);
            self.filled_subtrees.write(0, ZERO_VALUE);

            // zeros[i+1] = Hash(zeros[i], zeros[i])
            let mut current_zero: felt252 = ZERO_VALUE;
            let mut i: u32 = 1;
            while i <= TREE_LEVELS {
                let new_zero = bn254_poseidon_hash_2(current_zero, current_zero);
                self.zeros.write(i, new_zero);
                self.filled_subtrees.write(i, new_zero);
                current_zero = new_zero;
                i += 1;
            };

            // Initial root is the zero hash at the top level
            self.roots.write(0, current_zero);
            self.initialized.write(true);
        }

        /// Insert a leaf into the tree. Returns the leaf index.
        fn insert(ref self: ComponentState<TContractState>, leaf: felt252) -> u32 {
            assert(self.initialized.read(), 'Tree not initialized');
            let leaf_index = self.next_index.read();
            assert(leaf_index < 1048576, 'Merkle tree is full'); // 2^20

            let mut current_index = leaf_index;
            let mut current_level_hash = leaf;

            let mut i: u32 = 0;
            while i < TREE_LEVELS {
                if current_index % 2 == 0 {
                    // Current hash goes on the left; right sibling is the zero hash
                    self.filled_subtrees.write(i, current_level_hash);
                    let right = self.zeros.read(i);
                    current_level_hash = bn254_poseidon_hash_2(current_level_hash, right);
                } else {
                    // Current hash goes on the right; left sibling is the filled subtree
                    let left = self.filled_subtrees.read(i);
                    current_level_hash = bn254_poseidon_hash_2(left, current_level_hash);
                };

                current_index = current_index / 2;
                i += 1;
            };

            // Store new root in the ring buffer
            let new_root_index = (self.current_root_index.read() + 1) % ROOT_HISTORY_SIZE;
            self.current_root_index.write(new_root_index);
            self.roots.write(new_root_index, current_level_hash);

            self.next_index.write(leaf_index + 1);

            leaf_index
        }

        /// Check if a given root is among the last ROOT_HISTORY_SIZE roots.
        fn is_known_root(self: @ComponentState<TContractState>, root: felt252) -> bool {
            if root == 0 {
                return false;
            }

            let current = self.current_root_index.read();
            let mut i: u32 = 0;
            let mut found = false;
            while i < ROOT_HISTORY_SIZE {
                let idx = if current >= i {
                    current - i
                } else {
                    ROOT_HISTORY_SIZE - (i - current)
                };
                if self.roots.read(idx) == root {
                    found = true;
                    break;
                }
                i += 1;
            };

            found
        }

        /// Get the most recently computed root.
        fn get_last_root(self: @ComponentState<TContractState>) -> felt252 {
            self.roots.read(self.current_root_index.read())
        }
    }
}
