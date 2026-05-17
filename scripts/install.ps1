# Universal Install Script for Sticky Assistant (PowerShell)
$RepoUrl = "https://github.com/RubenBroere/sticky-assistant.git"
$TargetDir = "sticky-assistant"

Write-Host "🚀 Starting installation of Sticky Assistant..." -ForegroundColor Cyan

if (Test-Path $TargetDir) {
    Write-Host "❌ Directory $TargetDir already exists. Please remove it or choose a different location." -ForegroundColor Red
    exit
}

Write-Host "📦 Cloning repository..." -ForegroundColor Gray
git clone $RepoUrl $TargetDir
Set-Location $TargetDir

Write-Host "🛠️ Installing dependencies..." -ForegroundColor Gray
npm install

Write-Host "🔑 Checking clasp login status..." -ForegroundColor Gray
npx clasp login --status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please log in to Google via clasp:" -ForegroundColor Yellow
    npx clasp login
}

if (-not (Test-Path ".clasp.json")) {
    Write-Host "⚙️ Setting up .clasp.json..." -ForegroundColor Gray
    Copy-Item ".clasp.json.template" ".clasp.json"
    Write-Host "✅ .clasp.json created from template." -ForegroundColor Green
    Write-Host "👉 Action required: Open .clasp.json and replace YOUR_SCRIPT_ID with your Google Apps Script ID." -ForegroundColor Yellow
}

Write-Host "🏗️ Building project..." -ForegroundColor Gray
npm run build

Write-Host "✨ Installation complete!" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "1. cd $TargetDir"
Write-Host "2. Update scriptId in .clasp.json"
Write-Host "3. npm run push"
