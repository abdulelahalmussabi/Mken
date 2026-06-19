# Setup Vercel Environment Variables for Mken Project
# Usage: .\scripts\setup-vercel-env.ps1
# Requires: npx vercel login (run once)

$ErrorActionPreference = "Stop"

# Helper to decrypt secure string safely
function Get-PlainSecureString($secureStr) {
  if (-not $secureStr) { return "" }
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureStr)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    return $plain
  } catch {
    return ""
  }
}

Write-Host ""
Write-Host "=== Setup Vercel Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js / npx not found on system." -ForegroundColor Red
  exit 1
}

$supabaseUrl = Read-Host "Enter SUPABASE_URL (e.g., https://xxxxx.supabase.co)"
$supabaseKey = Read-Host "Enter SUPABASE_KEY (anon/public key)" -AsSecureString
$supabaseKeyPlain = Get-PlainSecureString $supabaseKey

$serviceKey = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY (service_role key)" -AsSecureString
$serviceKeyPlain = Get-PlainSecureString $serviceKey

Write-Host ""
Write-Host "--- Web Push (VAPID) ---" -ForegroundColor Cyan
Write-Host "Generate keys: cd scripts; npx web-push generate-vapid-keys" -ForegroundColor Yellow
$vapidPublic = Read-Host "Enter VAPID_PUBLIC_KEY"
$vapidPrivate = Read-Host "Enter VAPID_PRIVATE_KEY" -AsSecureString
$vapidPrivatePlain = Get-PlainSecureString $vapidPrivate
$vapidSubject = Read-Host "Enter VAPID_SUBJECT (Optional, default mailto:admin@mken.live)"

Write-Host ""
Write-Host "Updating variables on Vercel (Production + Preview)..." -ForegroundColor Yellow

Push-Location (Split-Path $PSScriptRoot -Parent)

# Helper to safely remove and add variable
function Set-VercelEnv($name, $val, $env) {
  if ($val) {
    # Attempt to delete first (suppress error if it doesn't exist)
    try {
      & npx vercel env rm $name $env -y 2>$null
    } catch {}
    
    # Add the new value
    echo $val | & npx vercel env add $name $env
  }
}

# SUPABASE_URL
Set-VercelEnv "SUPABASE_URL" $supabaseUrl "production"
Set-VercelEnv "SUPABASE_URL" $supabaseUrl "preview"

# SUPABASE_KEY
Set-VercelEnv "SUPABASE_KEY" $supabaseKeyPlain "production"
Set-VercelEnv "SUPABASE_KEY" $supabaseKeyPlain "preview"

# SUPABASE_SERVICE_ROLE_KEY
Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $serviceKeyPlain "production"
Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $serviceKeyPlain "preview"

# VAPID_PUBLIC_KEY
Set-VercelEnv "VAPID_PUBLIC_KEY" $vapidPublic "production"
Set-VercelEnv "VAPID_PUBLIC_KEY" $vapidPublic "preview"

# VAPID_PRIVATE_KEY
Set-VercelEnv "VAPID_PRIVATE_KEY" $vapidPrivatePlain "production"
Set-VercelEnv "VAPID_PRIVATE_KEY" $vapidPrivatePlain "preview"

# VAPID_SUBJECT
Set-VercelEnv "VAPID_SUBJECT" $vapidSubject "production"
Set-VercelEnv "VAPID_SUBJECT" $vapidSubject "preview"

Pop-Location

Write-Host ""
Write-Host "Completed successfully. Next steps:" -ForegroundColor Green
Write-Host "  1. Supabase -> SQL Editor -> Run the SQL from admin panel."
Write-Host "  2. Remove any variable named sb_publishable_* from Vercel (obsolete)."
Write-Host "  3. Deploy to production: npx vercel --prod"
Write-Host ""
