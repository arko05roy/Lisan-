#!/usr/bin/env bash
set -euo pipefail

# Redeploy only the ShieldedPool contract after code changes.
# Reuses existing tokens, deploys fresh verifiers for the pool.

PROFILE="lisan"

echo "=== Step 1: Declare MockGroth16Verifier (may already exist) ==="
MOCK_VERIFIER_DECLARE=$(sncast -p $PROFILE declare --contract-name MockGroth16Verifier 2>&1) || true
echo "$MOCK_VERIFIER_DECLARE"
MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$MOCK_VERIFIER_CLASS" ]; then
  MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "MockGroth16Verifier class hash: $MOCK_VERIFIER_CLASS"

echo ""
echo "=== Step 2: Deploy Pool verifier instances ==="

echo "Deploying pool_withdraw_verifier (n=4)..."
POOL_WITHDRAW_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 4 2>&1)
echo "$POOL_WITHDRAW_VERIFIER_RESULT"
POOL_WITHDRAW_VERIFIER=$(echo "$POOL_WITHDRAW_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "pool_withdraw_verifier: $POOL_WITHDRAW_VERIFIER"

echo "Deploying pool_transfer_verifier (n=4)..."
POOL_TRANSFER_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 4 2>&1)
echo "$POOL_TRANSFER_VERIFIER_RESULT"
POOL_TRANSFER_VERIFIER=$(echo "$POOL_TRANSFER_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "pool_transfer_verifier: $POOL_TRANSFER_VERIFIER"

echo ""
echo "=== Step 3: Declare new ShieldedPool ==="
POOL_DECLARE=$(sncast -p $PROFILE declare --contract-name ShieldedPool 2>&1) || true
echo "$POOL_DECLARE"
POOL_CLASS=$(echo "$POOL_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$POOL_CLASS" ]; then
  POOL_CLASS=$(echo "$POOL_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "ShieldedPool class: $POOL_CLASS"

echo ""
echo "=== Step 4: Deploy new ShieldedPool ==="
# ShieldedPool(withdraw_verifier, transfer_verifier)
POOL_DEPLOY=$(sncast -p $PROFILE deploy \
  --class-hash "$POOL_CLASS" \
  --constructor-calldata "$POOL_WITHDRAW_VERIFIER" "$POOL_TRANSFER_VERIFIER" 2>&1)
echo "$POOL_DEPLOY"
POOL_ADDR=$(echo "$POOL_DEPLOY" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')

echo ""
echo "==========================================="
echo "NEW ShieldedPool ADDRESS: $POOL_ADDR"
echo "==========================================="
echo ""
echo "Update .env.local:"
echo "NEXT_PUBLIC_SHIELDED_POOL=$POOL_ADDR"
