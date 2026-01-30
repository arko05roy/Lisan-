#!/bin/bash
# Compile all Circom circuits to R1CS + WASM
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUITS_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$CIRCUITS_DIR/build"

mkdir -p "$BUILD_DIR"

CIRCUITS=(
    "pool_withdraw"
    "pool_transfer"
    "amm_withdraw"
    "amm_swap"
    "bet_claim"
)

for CIRCUIT in "${CIRCUITS[@]}"; do
    echo "Compiling $CIRCUIT..."
    circom "$CIRCUITS_DIR/$CIRCUIT.circom" \
        --r1cs \
        --wasm \
        --sym \
        -o "$BUILD_DIR/"
    echo "$CIRCUIT compiled successfully."
done

echo "All circuits compiled."
