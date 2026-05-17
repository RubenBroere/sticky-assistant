# Universal Install Script for Sticky Assistant (PowerShell)
$RepoUrl = "https://github.com/RubenBroere/sticky-assistant.git"
$TargetDir = "sticky-assistant"

Write-Host "Starting installation of Sticky Assistant..." -ForegroundColor Cyan

if (Test-Path $TargetDir) {
    Write-Host "Directory $TargetDir already exists. Please remove it or choose a different location." -ForegroundColor Red
    exit
}

Write-Host "Cloning repository..." -ForegroundColor Gray
git clone $RepoUrl $TargetDir
Set-Location $TargetDir

Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --silent --no-fund --no-audit

Write-Host "Checking Google Apps Script authentication..." -ForegroundColor Gray

# We run a harmless clasp command to see if Google accepts our credentials.
# '2>&1' catches any errors so they don't clutter the terminal, saving them to $authCheck.
$authCheck = npx clasp list 2>&1

if ($LASTEXITCODE -ne 0) {
    # If the command failed, let's check WHY it failed.
    # Did they forget to enable the API in their Google Account?
    if ($authCheck -match "Apps Script API") {
        Write-Host "Google Apps Script API is not enabled for your account!" -ForegroundColor Red
        Write-Host "Please visit the following link, turn it ON, and run this script again:" -ForegroundColor Yellow
        Write-Host "https://script.google.com/home/usersettings" -ForegroundColor Cyan
        exit
    }
    
    # If it's not the API, their token is missing or expired.
    Write-Host "You are not logged in or your session has expired. Opening browser..." -ForegroundColor Yellow
    npx clasp login
} else {
    Write-Host "Already authenticated with Clasp." -ForegroundColor Green
}

if (-not (Test-Path ".clasp.json")) {
    Write-Host "Creating new Apps Script project..." -ForegroundColor Gray
    $ProjectTitle = Read-Host "Enter a title for your Apps Script project [Sticky Assistant]"
    if ([string]::IsNullOrWhiteSpace($ProjectTitle)) { $ProjectTitle = "Sticky Assistant" }
    
    npx clasp create --title "$ProjectTitle" --type standalone --rootDir ./dist
    Write-Host "Apps Script project created and .clasp.json configured." -ForegroundColor Green
}

# Run the build separately, then force push to bypass the manifest overwrite prompt
Write-Host "Building project..." -ForegroundColor Gray
npm run build --silent

Write-Host "Pushing to Google account..." -ForegroundColor Gray
npx clasp push --force

Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "Run 'npx clasp open' to view your project in the browser." -ForegroundColor Cyan