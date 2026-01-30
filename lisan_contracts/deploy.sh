#!/usr/bin/env bash
set -euo pipefail

# Deploy all contracts to Starknet Sepolia using sncast
# Uses MockGroth16Verifier for demo (skips real proof verification)

PROFILE="lisan"
CONTRACTS_DIR="target/dev"

# Existing token + oracle addresses (already deployed)
MOCK_BTC="0x03ffc3ab1419ed9daa9cc49d0f000b13f23c47b42bb931d1cf1cbbb22639ba8f"
MOCK_STRK="0x023de67f0eaa413e33173e040bfbaa25c5e0a47d74c69e7acaecedd64afbd37f"
MOCK_ORACLE="0x07c57f85bf5febfde9bfbef4444d1359b0fdadc87bacb4f2516ad9bc33f4d8ba"
OWNER="0x046d2cac6a901884710a584b200795810f0d7956bce9638d274d71867171b00b"

echo "=== Step 1: Declare MockGroth16Verifier ==="
MOCK_VERIFIER_DECLARE=$(sncast -p $PROFILE declare \
  --contract-name MockGroth16Verifier 2>&1) || true
echo "$MOCK_VERIFIER_DECLARE"

# Extract class hash - try from declare output, or from "already declared" error
MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$MOCK_VERIFIER_CLASS" ]; then
  MOCK_VERIFIER_CLASS=$(echo "$MOCK_VERIFIER_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "MockGroth16Verifier class hash: $MOCK_VERIFIER_CLASS"

echo ""
echo "=== Step 2: Deploy 5 MockGroth16Verifier instances ==="

# pool_withdraw: 3 public inputs (root, nullifierHash, withdrawAmount)
echo "Deploying pool_withdraw_verifier (n=3)..."
POOL_WITHDRAW_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 3 2>&1)
echo "$POOL_WITHDRAW_VERIFIER_RESULT"
POOL_WITHDRAW_VERIFIER=$(echo "$POOL_WITHDRAW_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "pool_withdraw_verifier: $POOL_WITHDRAW_VERIFIER"

# pool_transfer: 4 public inputs (root, nullifierHash, newCommSender, newCommRecipient)
echo "Deploying pool_transfer_verifier (n=4)..."
POOL_TRANSFER_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 4 2>&1)
echo "$POOL_TRANSFER_VERIFIER_RESULT"
POOL_TRANSFER_VERIFIER=$(echo "$POOL_TRANSFER_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "pool_transfer_verifier: $POOL_TRANSFER_VERIFIER"

# amm_withdraw: 4 public inputs (root, nullifierHash, tokenType, withdrawAmount)
echo "Deploying amm_withdraw_verifier (n=4)..."
AMM_WITHDRAW_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 4 2>&1)
echo "$AMM_WITHDRAW_VERIFIER_RESULT"
AMM_WITHDRAW_VERIFIER=$(echo "$AMM_WITHDRAW_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "amm_withdraw_verifier: $AMM_WITHDRAW_VERIFIER"

# amm_swap: 7 public inputs (root, nullifierHash, tokenTypeIn, amountIn, tokenTypeOut, newCommitment, amountOut)
echo "Deploying amm_swap_verifier (n=7)..."
AMM_SWAP_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 7 2>&1)
echo "$AMM_SWAP_VERIFIER_RESULT"
AMM_SWAP_VERIFIER=$(echo "$AMM_SWAP_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "amm_swap_verifier: $AMM_SWAP_VERIFIER"

# bet_claim: 3 public inputs (betCommitment, nullifierHash, winningOutcome)
echo "Deploying bet_claim_verifier (n=3)..."
BET_CLAIM_VERIFIER_RESULT=$(sncast -p $PROFILE deploy \
  --class-hash "$MOCK_VERIFIER_CLASS" \
  --constructor-calldata 3 2>&1)
echo "$BET_CLAIM_VERIFIER_RESULT"
BET_CLAIM_VERIFIER=$(echo "$BET_CLAIM_VERIFIER_RESULT" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "bet_claim_verifier: $BET_CLAIM_VERIFIER"

echo ""
echo "=== Step 3: Declare main contracts ==="

echo "Declaring ShieldedPool..."
POOL_DECLARE=$(sncast -p $PROFILE declare --contract-name ShieldedPool 2>&1) || true
echo "$POOL_DECLARE"
POOL_CLASS=$(echo "$POOL_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$POOL_CLASS" ]; then
  POOL_CLASS=$(echo "$POOL_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "ShieldedPool class: $POOL_CLASS"

echo "Declaring ShieldedAMM..."
AMM_DECLARE=$(sncast -p $PROFILE declare --contract-name ShieldedAMM 2>&1) || true
echo "$AMM_DECLARE"
AMM_CLASS=$(echo "$AMM_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$AMM_CLASS" ]; then
  AMM_CLASS=$(echo "$AMM_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "ShieldedAMM class: $AMM_CLASS"

echo "Declaring PredictionMarket..."
PM_DECLARE=$(sncast -p $PROFILE declare --contract-name PredictionMarket 2>&1) || true
echo "$PM_DECLARE"
PM_CLASS=$(echo "$PM_DECLARE" | grep -oE "class_hash: 0x[0-9a-fA-F]+" | head -1 | awk '{print $2}')
if [ -z "$PM_CLASS" ]; then
  PM_CLASS=$(echo "$PM_DECLARE" | grep -oE "0x[0-9a-fA-F]{50,}" | head -1)
fi
echo "PredictionMarket class: $PM_CLASS"

echo ""
echo "=== Step 4: Deploy main contracts ==="

# ShieldedPool(btc_token, withdraw_verifier, transfer_verifier)
echo "Deploying ShieldedPool..."
POOL_DEPLOY=$(sncast -p $PROFILE deploy \
  --class-hash "$POOL_CLASS" \
  --constructor-calldata "$MOCK_BTC" "$POOL_WITHDRAW_VERIFIER" "$POOL_TRANSFER_VERIFIER" 2>&1)
echo "$POOL_DEPLOY"
POOL_ADDR=$(echo "$POOL_DEPLOY" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "ShieldedPool: $POOL_ADDR"

# ShieldedAMM(owner, btc_token, strk_token, swap_verifier, withdraw_verifier)
echo "Deploying ShieldedAMM..."
AMM_DEPLOY=$(sncast -p $PROFILE deploy \
  --class-hash "$AMM_CLASS" \
  --constructor-calldata "$OWNER" "$MOCK_BTC" "$MOCK_STRK" "$AMM_SWAP_VERIFIER" "$AMM_WITHDRAW_VERIFIER" 2>&1)
echo "$AMM_DEPLOY"
AMM_ADDR=$(echo "$AMM_DEPLOY" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "ShieldedAMM: $AMM_ADDR"

# PredictionMarket(btc_token, oracle, bet_claim_verifier)
echo "Deploying PredictionMarket..."
PM_DEPLOY=$(sncast -p $PROFILE deploy \
  --class-hash "$PM_CLASS" \
  --constructor-calldata "$MOCK_BTC" "$MOCK_ORACLE" "$BET_CLAIM_VERIFIER" 2>&1)
echo "$PM_DEPLOY"
PM_ADDR=$(echo "$PM_DEPLOY" | grep -oE "contract_address: 0x[0-9a-fA-F]+" | awk '{print $2}')
echo "PredictionMarket: $PM_ADDR"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Update .env.local with:"
echo "NEXT_PUBLIC_SHIELDED_POOL=$POOL_ADDR"
echo "NEXT_PUBLIC_SHIELDED_AMM=$AMM_ADDR"
echo "NEXT_PUBLIC_PREDICTION_MARKET=$PM_ADDR"
