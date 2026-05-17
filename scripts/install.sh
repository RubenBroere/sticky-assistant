#!/bin/bash
set -e

# Universal Install Script for Sticky Assistant
REPO_URL="https://github.com/RubenBroere/sticky-assistant.git"
TARGET_DIR="sticky-assistant"

echo "🚀 Starting installation of Sticky Assistant..."

if [ -d "$TARGET_DIR" ]; then
  echo "❌ Directory $TARGET_DIR already exists. Please remove it or choose a different location."
  exit 1
fi

echo "📦 Cloning repository..."
git clone "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

echo "🛠️ Installing dependencies..."
npm install

echo "🔑 Checking clasp login status..."
if ! npx clasp login --status > /dev/null 2>&1; then
  echo "Please log in to Google via clasp:"
  npx clasp login
fi

if [ ! -f ".clasp.json" ]; then
  echo "⚙️ Setting up .clasp.json..."
  cp .clasp.json.template .clasp.json
  echo "✅ .clasp.json created from template."
  echo "👉 Action required: Open .clasp.json and replace YOUR_SCRIPT_ID with your Google Apps Script ID."
fi

echo "🏗️ Building project..."
npm run build

echo "✨ Installation complete!"
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. Update scriptId in .clasp.json"
echo "3. npm run push"
