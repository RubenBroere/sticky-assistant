#!/bin/bash
set -e

# Colors for output
CYAN='\033[0;36m'
RED='\033[0;31m'
GRAY='\033[0;90m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Universal Install Script for Sticky Assistant (Bash)
REPO_URL="https://github.com/RubenBroere/sticky-assistant.git"
TARGET_DIR="sticky-assistant"

echo -e "${CYAN}Starting installation of Sticky Assistant...${NC}"

if [ -d "$TARGET_DIR" ]; then
  echo -e "${RED}Directory $TARGET_DIR already exists. Please remove it or choose a different location.${NC}"
  exit 1
fi

echo -e "${GRAY}Cloning repository...${NC}"
git clone "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

echo -e "${GRAY}Installing dependencies...${NC}"
npm install --silent --no-fund --no-audit

# --- UPDATED AUTHENTICATION CHECK ---
echo -e "${GRAY}Checking Google Apps Script authentication...${NC}"

# Temporarily disable 'set -e' so the script doesn't instantly crash if 'clasp list' fails
set +e
AUTH_CHECK=$(npx clasp list 2>&1)
CLASP_EXIT_CODE=$?
set -e # Re-enable 'set -e'

if [ $CLASP_EXIT_CODE -ne 0 ]; then
  # If the command failed, let's check WHY it failed.
  if echo "$AUTH_CHECK" | grep -q "Apps Script API"; then
    echo -e "${RED}Google Apps Script API is not enabled for your account!${NC}"
    echo -e "${YELLOW}Please visit the following link, turn it ON, and run this script again:${NC}"
    echo -e "${CYAN}https://script.google.com/home/usersettings${NC}"
    exit 1
  fi
  
  # If it's not the API, their token is missing or expired.
  echo -e "${YELLOW}You are not logged in or your session has expired. Opening browser...${NC}"
  npx clasp login
else
  echo -e "${GREEN}Already authenticated with Clasp.${NC}"
fi
# ------------------------------------

if [ ! -f ".clasp.json" ]; then
  echo -e "${GRAY}Creating new Apps Script project...${NC}"
  
  # Prompt for project title or use default
  read -p "Enter a title for your Apps Script project [Sticky Assistant]: " PROJECT_TITLE
  PROJECT_TITLE=${PROJECT_TITLE:-"Sticky Assistant"}
  
  npx clasp create --title "$PROJECT_TITLE" --type standalone --rootDir ./dist
  echo -e "${GREEN}Apps Script project created and .clasp.json configured.${NC}"
fi

# Run the build separately, then force push to bypass the manifest overwrite prompt
echo -e "${GRAY}Building project...${NC}"
npm run build --silent

echo -e "${GRAY}Pushing to Google servers...${NC}"
npx clasp push --force

echo -e "${GREEN}Installation complete!${NC}"
echo -e "${CYAN}Run 'npx clasp open' to view your project in the browser.${NC}"