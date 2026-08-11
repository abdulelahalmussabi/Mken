# Setup Vercel Environment Variables for Mkn Project (Next.js)
# Usage: .\scripts\setup-vercel-env.ps1

$ErrorActionPreference = "Stop"

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
Write-Host "=== Mkn Next.js - Setup Vercel Production Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js / npx not found on system." -ForegroundColor Red
  exit 1
}

$supabaseUrl = Read-Host "Enter NEXT_PUBLIC_SUPABASE_URL (e.g., https://xxxxx.supabase.co)"
$supabaseAnonKey = Read-Host "Enter NEXT_PUBLIC_SUPABASE_ANON_KEY (anon/public key)" -AsSecureString
$supabaseAnonKeyPlain = Get-PlainSecureString $supabaseAnonKey

$serviceKey = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY (real service_role key)" -AsSecureString
$serviceKeyPlain = Get-PlainSecureString $serviceKey

$sessionSecret = Read-Host "Enter ADMIN_SESSION_SECRET (e.g. random 32-byte hash)" -AsSecureString
$sessionSecretPlain = Get-PlainSecureString $sessionSecret

$superEmail = Read-Host "Enter ADMIN_SUPER_EMAIL (default: admin@mken.live)"
if (-not $superEmail) { $superEmail = "admin@mken.live" }

$superPassHash = Read-Host "Enter ADMIN_SUPER_PASSWORD_HASH" -AsSecureString
$superPassHashPlain = Get-PlainSecureString $superPassHash

Write-Host ""
Write-Host "Updating variables on Vercel project (mkn)..." -ForegroundColor Yellow

function Set-VercelEnv($name, $val, $env) {
  if ($val) {
    try {
      & npx vercel env rm $name $env -y 2>$null
    } catch {}
    echo $val | & npx vercel env add $name $env
  }
}

# Apply variables to production and preview environments
Set-VercelEnv "NEXT_PUBLIC_SUPABASE_URL" $supabaseUrl "production"
Set-VercelEnv "NEXT_PUBLIC_SUPABASE_URL" $supabaseUrl "preview"

Set-VercelEnv "NEXT_PUBLIC_SUPABASE_ANON_KEY" $supabaseAnonKeyPlain "production"
Set-VercelEnv "NEXT_PUBLIC_SUPABASE_ANON_KEY" $supabaseAnonKeyPlain "preview"

Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $serviceKeyPlain "production"
Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $serviceKeyPlain "preview"

Set-VercelEnv "ADMIN_SESSION_SECRET" $sessionSecretPlain "production"
Set-VercelEnv "ADMIN_SESSION_SECRET" $sessionSecretPlain "preview"

Set-VercelEnv "ADMIN_SUPER_EMAIL" $superEmail "production"
Set-VercelEnv "ADMIN_SUPER_EMAIL" $superEmail "preview"

Set-VercelEnv "ADMIN_SUPER_PASSWORD_HASH" $superPassHashPlain "production"
Set-VercelEnv "ADMIN_SUPER_PASSWORD_HASH" $superPassHashPlain "preview"

Write-Host ""
Write-Host "Vercel Environment Setup Complete!" -ForegroundColor Green
Write-Host "Deploy to Production command: npx vercel --prod" -ForegroundColor Yellow
Write-Host ""
