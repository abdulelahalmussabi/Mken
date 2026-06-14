# إعداد متغيرات Vercel لمشروع مكِّن
# الاستخدام: .\scripts\setup-vercel-env.ps1
# يتطلب: npx vercel login (مرة واحدة)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== إعداد متغيرات Vercel لمكِّن ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js / npx غير متوفر." -ForegroundColor Red
  exit 1
}

$supabaseUrl = Read-Host "SUPABASE_URL (مثال: https://xxxxx.supabase.co)"
$supabaseKey = Read-Host "SUPABASE_KEY (مفتاح anon / publishable)" -AsSecureString
$supabaseKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabaseKey)
)
$serviceKey = Read-Host "SUPABASE_SERVICE_ROLE_KEY (مفتاح service_role)" -AsSecureString
$serviceKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceKey)
)

Write-Host ""
Write-Host "--- Web Push (VAPID) ---" -ForegroundColor Cyan
Write-Host "أنشئ المفاتيح: cd scripts; npx web-push generate-vapid-keys"
Write-Host "Public Key يُحفظ في لوحة الإدارة. Private Key يُضاف هنا فقط." -ForegroundColor Yellow
$vapidPublic = Read-Host "VAPID_PUBLIC_KEY"
$vapidPrivate = Read-Host "VAPID_PRIVATE_KEY" -AsSecureString
$vapidPrivatePlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($vapidPrivate)
)
$vapidSubject = Read-Host "VAPID_SUBJECT (اختياري، افتراضي mailto:admin@mken.live)"

Write-Host ""
Write-Host "جاري إضافة المتغيرات إلى Vercel (Production + Preview)..." -ForegroundColor Yellow

Push-Location (Split-Path $PSScriptRoot -Parent)

echo $supabaseUrl | npx vercel env add SUPABASE_URL production preview
echo $supabaseKeyPlain | npx vercel env add SUPABASE_KEY production preview
echo $serviceKeyPlain | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production preview
echo $vapidPublic | npx vercel env add VAPID_PUBLIC_KEY production preview
echo $vapidPrivatePlain | npx vercel env add VAPID_PRIVATE_KEY production preview
if ($vapidSubject) {
  echo $vapidSubject | npx vercel env add VAPID_SUBJECT production preview
}

Pop-Location

Write-Host ""
Write-Host "تم. الخطوات التالية:" -ForegroundColor Green
Write-Host "  1. Supabase → SQL Editor → نفّذ SQL من لوحة المطور (جدول mken_push_subscriptions)."
Write-Host "  2. admin.html → Web Push → فعّل + الصق Public Key → حفظ → اشتراك هذا الجهاز → اختبار Push"
Write-Host "  3. احذف أي متغير باسم sb_publishable_* من Vercel (اسم خاطئ)."
Write-Host "  4. npx vercel --prod  (إعادة النشر)"
Write-Host ""
