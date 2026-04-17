#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Ensure HyperFrames CLI is available for video composition workflows
if ! npx --yes hyperframes --version &>/dev/null; then
  echo "Warning: hyperframes CLI not available" >&2
fi
