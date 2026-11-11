#!/usr/bin/env bash
# Deploy tummo, then delete every access key on the contract account.
# After this nobody, including you, can redeploy the code, change a rule or move the treasury.
# Needs near-cli-rs (npm i -g near-cli-rs). Works the same in Git Bash on Windows.
set -euo pipefail

ACCOUNT="${1:?usage: deploy-and-lock.sh <contract-account> [testnet|mainnet] [path/to/tummo.wasm]}"
NET="${2:-testnet}"
WASM="${3:-contract/target/near/tummo.wasm}"

near contract deploy "$ACCOUNT" use-file "$WASM" with-init-call new json-args '{}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config "$NET" sign-with-keychain send

echo
echo "Smoke test before locking. Once the keys are gone there is no fixing anything."
near contract call-function as-read-only "$ACCOUNT" get_config json-args '{}' network-config "$NET" now

echo
near account list-keys "$ACCOUNT" network-config "$NET" now
read -r -p "Paste each public key to delete, separated by commas (ed25519:...): " KEYS
read -r -p "Type LOCK to delete them for good: " OK
[ "$OK" = "LOCK" ] || { echo "Not locked."; exit 1; }

near account delete-keys "$ACCOUNT" public-keys "$KEYS" network-config "$NET" sign-with-keychain send
echo
near account list-keys "$ACCOUNT" network-config "$NET" now
echo "Done. The app's lock badge reads this key list straight from RPC."
