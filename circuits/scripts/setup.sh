#!/bin/bash
# Trusted setup for all circuits (Groth16 on BN254)
# Downloads Powers of Tau if not present, then runs per-circuit setup.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUITS_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$CIRCUITS_DIR/build"

PTAU_FILE="$BUILD_DIR/powersOfTau28_hez_final_20.ptau"

# Download Powers of Tau (depth 20, ~1M constraints) if not present
if [ ! -f "$PTAU_FILE" ]; then
    echo "Downloading Powers of Tau (2^20)..."
    curl -L -o "$PTAU_FILE" \
        "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau"
    echo "Download complete."
fi

CIRCUITS=(
    "pool_withdraw"
    "pool_transfer"
    "amm_withdraw"
    "amm_swap"
    "bet_claim"
)

for CIRCUIT in "${CIRCUITS[@]}"; do
    echo "=== Setting up $CIRCUIT ==="

    R1CS="$BUILD_DIR/$CIRCUIT.r1cs"
    ZKEY_0="$BUILD_DIR/${CIRCUIT}_0.zkey"
    ZKEY_FINAL="$BUILD_DIR/${CIRCUIT}_final.zkey"
    VK="$BUILD_DIR/${CIRCUIT}_vk.json"

    if [ ! -f "$R1CS" ]; then
        echo "ERROR: $R1CS not found. Run compile.sh first."
        exit 1
    fi

    # Phase 2: circuit-specific setup
    echo "  groth16 setup..."
    npx snarkjs groth16 setup "$R1CS" "$PTAU_FILE" "$ZKEY_0"

    # Contribute randomness (single contributor for dev/testnet)
    echo "  contributing randomness..."
    echo "lisan-dev-entropy-$(date +%s)" | \
        npx snarkjs zkey contribute "$ZKEY_0" "$ZKEY_FINAL" \
        --name="lisan-dev" -v

    # Export verification key
    echo "  exporting verification key..."
    npx snarkjs zkey export verificationkey "$ZKEY_FINAL" "$VK"

    # Cleanup intermediate zkey
    rm -f "$ZKEY_0"

    echo "$CIRCUIT setup complete."
done

echo "All circuits set up. Verification keys in $BUILD_DIR/*_vk.json"
