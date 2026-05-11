$ErrorActionPreference = "Stop"

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
  Write-Host "clasp not found. Installing globally..."
  npm install -g @google/clasp
}

Write-Host "Logging in to Google (if needed)..."
clasp login

Write-Host "Creating Apps Script project..."
clasp create --type standalone --title "Sticky Assistant"

$scriptId = Read-Host "Enter your Apps Script scriptId (from the create output)"
if ([string]::IsNullOrWhiteSpace($scriptId)) {
  throw "scriptId is required."
}

if (-not (Test-Path .clasp.json.template)) {
  throw ".clasp.json.template not found."
}

(Get-Content .clasp.json.template) -replace "YOUR_SCRIPT_ID", $scriptId | Set-Content .clasp.json

Write-Host "Pushing files to Apps Script..."
clasp push

Write-Host "Opening Apps Script project..."
clasp open

Write-Host "Done."
