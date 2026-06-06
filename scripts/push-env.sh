#!/usr/bin/env bash
#
# push-env.sh — push variables from .env.local to Vercel.
#
# Usage:
#   ./scripts/push-env.sh                       # push to production preview development
#   ./scripts/push-env.sh production            # push to a single environment
#   ENV_FILE=.env.production ./scripts/push-env.sh production
#
# Existing values are overwritten (removed, then re-added) so the script is
# safe to re-run. Requires the Vercel CLI (`npm i -g vercel`) and a logged-in
# session (`vercel login`).

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
TARGETS=("$@")
if [ ${#TARGETS[@]} -eq 0 ]; then
  TARGETS=(production preview development)
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI not found. Install it with: npm i -g vercel"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Env file not found: $ENV_FILE"
  exit 1
fi

# Ensure the project is linked so env commands know where to push.
if [ ! -f ".vercel/project.json" ]; then
  echo "🔗 Project not linked. Running 'vercel link'..."
  vercel link
fi

echo "📤 Pushing variables from $ENV_FILE to: ${TARGETS[*]}"
echo ""

pushed=0
skipped=0

while IFS= read -r line || [ -n "$line" ]; do
  # Strip leading/trailing whitespace.
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"

  # Skip blank lines and comments.
  [ -z "$line" ] && continue
  case "$line" in
    \#*) continue ;;
  esac

  # Only handle KEY=VALUE lines.
  case "$line" in
    *=*) ;;
    *) continue ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"

  # Trim optional surrounding quotes from the value.
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  # Drop an optional "export " prefix on the key.
  key="${key#export }"
  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"

  if [ -z "$value" ]; then
    echo "⏭️  $key (empty value, skipped)"
    skipped=$((skipped + 1))
    continue
  fi

  for target in "${TARGETS[@]}"; do
    # Remove any existing value first so re-runs don't error or duplicate.
    vercel env rm "$key" "$target" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$key" "$target" >/dev/null 2>&1
    echo "✅ $key → $target"
  done
  pushed=$((pushed + 1))

done < "$ENV_FILE"

echo ""
echo "Done. Pushed $pushed variable(s), skipped $skipped."
echo "Tip: redeploy for changes to take effect (vercel --prod)."
