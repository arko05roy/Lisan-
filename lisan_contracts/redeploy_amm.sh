#!/usr/bin/env bash
set -euo pipefail

# Redeploy only the ShieldedAMM contract after code changes.
# Reuses existing tokens, oracle, and deploys fresh verifiers for the AMM.

PROFILE="lisan"

MOCK_BTC="0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f"
MOCK_STRK="0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f"
OWNER="0x046d2cac6a901884710a584b200795810f0d7956bce9638d274d71867171b00b"

echo "=== Step 1: Declare MockGroth16Verifier (may already exist) ==="
MOCK_VERIFIER_DECLARE=$(sncast -p $PROFILE declare --contract-name MockGroth16Verifier 2>&1) || true
echo "$MOCK_VERIFIER_DECLARE"
MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$MOCK_VERIFIER_CLASS" ]; then
  MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "MockGroth16Verifier class hash: $MOCK_VERIFIER_CLASS"

echo ""
echo "=== Step 2: Deploy AMM verifier instances ==="

echo "Deploying amm_swap_verifier (n=7)..."
AMM_SWAP_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 7 2>&1)
echo "$AMM_SWAP_VERIFIER_RESULT"
AMM_SWAP_VERIFIER=$(echo "$AMM_SWAP_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "amm_swap_verifier: $AMM_SWAP_VERIFIER"

echo "Deploying amm_withdraw_verifier (n=4)..."
AMM_WITHDRAW_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 4 2>&1)
echo "$AMM_WITHDRAW_VERIFIER_RESULT"
AMM_WITHDRAW_VERIFIER=$(echo "$AMM_WITHDRAW_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "amm_withdraw_verifier: $AMM_WITHDRAW_VERIFIER"

echo ""
echo "=== Step 3: Declare new ShieldedAMM ==="
AMM_DECLARE=$(sncast -p $PROFILE declare --contract-name ShieldedAMM 2>&1) || true
echo "$AMM_DECLARE"
AMM_CLASS=$(echo "$AMM_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$AMM_CLASS" ]; then
  AMM_CLASS=$(echo "$AMM_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "ShieldedAMM class: $AMM_CLASS"

echo ""
echo "=== Step 4: Deploy new ShieldedAMM ==="
# ShieldedAMM(owner, btc_token, strk_token, swap_verifier, withdraw_verifier)
AMM_DEPLOY=$(sncast -p $PROFILE deploy \
  --class-hash "$AMM_CLASS" \
  --constructor-calldata "$OWNER" "$MOCK_BTC" "$MOCK_STRK" "$AMM_SWAP_VERIFIER" "$AMM_WITHDRAW_VERIFIER" 2>&1)
echo "$AMM_DEPLOY"
AMM_ADDR=$(echo "$AMM_DEPLOY" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')

echo ""
echo "==========================================="
echo "NEW ShieldedAMM ADDRESS: $AMM_ADDR"
echo "==========================================="
echo ""
echo "Update .env.local:"
echo "NEXT_PUBLIC_SHIELDED_AMM=$AMM_ADDR"
