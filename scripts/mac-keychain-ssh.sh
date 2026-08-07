#!/bin/bash
set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_directory/.."

env_value() {
  node -e 'try { process.loadEnvFile(".env") } catch (error) { if (error.code !== "ENOENT") throw error } process.stdout.write(process.env[process.argv[1]] ?? "")' "$1"
}

keytab_password="${KEYTAB_KEYCHAIN_PASSWORD:-${SSH_USER_PWD:-}}"
if [[ -z "$keytab_password" ]]; then keytab_password="$(env_value KEYTAB_KEYCHAIN_PASSWORD)"; fi
if [[ -z "$keytab_password" ]]; then keytab_password="$(env_value SSH_USER_PWD)"; fi
if [[ -z "$keytab_password" ]]; then
  echo "KEYTAB_KEYCHAIN_PASSWORD or SSH_USER_PWD is required" >&2
  exit 1
fi
keytab_keychain="${KEYTAB_KEYCHAIN_PATH:-$(env_value KEYTAB_KEYCHAIN_PATH)}"
if [[ -z "$keytab_keychain" ]]; then keytab_keychain="$USER/Library/Keychains/login.keychain-db"; fi
unset KEYTAB_KEYCHAIN_PASSWORD SSH_USER_PWD
security unlock-keychain -p "$keytab_password" "$keytab_keychain"
security set-keychain-settings -lut 21600 "$keytab_keychain"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$keytab_password" "$keytab_keychain" >/dev/null
echo "mac:ssh:keychain: ok"
