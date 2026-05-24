#!/usr/bin/env bash
# Load .env.local safely (handles values with spaces, special chars)
# Usage: source _AUDIT/.../with-env.sh
set +e
while IFS='=' read -r key value; do
  # Skip comments and empty
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  # Only valid identifiers
  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
  # Strip surrounding quotes if present
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  export "$key"="$value"
done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env.local | tr -d '\r')
