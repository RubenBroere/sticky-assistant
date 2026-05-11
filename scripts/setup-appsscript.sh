#!/usr/bin/env bash
set -euo pipefail

if ! command -v clasp >/dev/null 2>&1; then
  echo "clasp not found. Installing globally..."
  npm install -g @google/clasp
fi

echo "Logging in to Google (if needed)..."
clasp login

echo "Creating Apps Script project..."
clasp create --type standalone --title "Sticky Assistant"

echo "Enter your Apps Script scriptId (from the create output):"
read -r SCRIPT_ID

if [ -z "$SCRIPT_ID" ]; then
  echo "scriptId is required. Exiting."
  exit 1
fi

if [ ! -f .clasp.json.template ]; then
  echo ".clasp.json.template not found. Exiting."
  exit 1
fi

sed "s/YOUR_SCRIPT_ID/${SCRIPT_ID}/g" .clasp.json.template > .clasp.json

echo "Pushing files to Apps Script..."
clasp push

echo "Opening Apps Script project..."
clasp open

echo "Done."
