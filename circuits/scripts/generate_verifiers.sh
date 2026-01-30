#!/bin/bash
# Generate Garaga Cairo verifier contracts from verification keys.
# Requires: garaga CLI installed (pip install garaga)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUITS_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$CIRCUITS_DIR/build"
OUTPUT_DIR="$CIRCUITS_DIR/../lisan_contracts/src/garaga_verifiers"

mkdir -p "$OUTPUT_DIR"

CIRCUITS=(
    "pool_withdraw"
    "pool_transfer"
    "amm_withdraw"
    "amm_swap"
    "bet_claim"
)

for CIRCUIT in "${CIRCUITS[@]}"; do
    VK="$BUILD_DIR/${CIRCUIT}_vk.json"

    if [ ! -f "$VK" ]; then
        echo "ERROR: $VK not found. Run setup.sh first."
        exit 1
    fi

    echo "Generating Cairo verifier for $CIRCUIT..."
    garaga gen \
        --vk "$VK" \
        --system groth16 \
        --output-dir "$OUTPUT_DIR/"

    echo "$CIRCUIT verifier generated."
done

echo "All verifiers generated in $OUTPUT_DIR/"
echo "NOTE: You may need to rename the generated files to match expected module names."
