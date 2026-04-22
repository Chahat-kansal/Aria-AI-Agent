#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p artifacts

ZIP_PATH="artifacts/Aria-AI-Agent-source-only.zip"
TAR_PATH="artifacts/Aria-AI-Agent-source-only.tar.gz"

zip -rq "$ZIP_PATH" . \
  -x '.git/*' 'node_modules/*' '.next/*' 'artifacts/*'

tar -czf "$TAR_PATH" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='artifacts' \
  .

echo "Created: $ZIP_PATH"
echo "Created: $TAR_PATH"
