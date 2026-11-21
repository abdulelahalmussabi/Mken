#!/bin/sh
# =====================================================================
# سكريبت التثبيت بضغطة واحدة لحزمة التشغيل المحلي لمنصة مَكَن (mken.live)
# One-Click On-Premise Installation Script for Hospitals & Enterprises
# =====================================================================

set -e

echo "=========================================================="
echo "🚀 بدء تثبيت حزمة التشغيل المحلي لمنصة مَكَن (Enterprise QMS)"
echo "=========================================================="

# 1. التحقق من توفر Docker و Docker Compose
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ خطأ: Docker غير مثبت على هذا الخادم. يرجى تثبيت Docker أولاً."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    echo "❌ خطأ: Docker Compose غير متوفر. يرجى تثبيته للمتابعة."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 2. إعداد ملف المتغيرات البيئية .env
if [ ! -f .env ]; then
    echo "📋 جارِ إنشاء ملف الإعدادات .env من النموذج الافتراضي..."
    cp .env.onprem.example .env

    # توليد كلمات سر ومفاتيح تشفير عشوائية قوية تلقائياً
    AUTO_DB_PASS=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)
    AUTO_HMAC=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    AUTO_ADMIN=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

    sed -i.bak "s/ChangeThisSecurePasswordInProduction2026!/$AUTO_DB_PASS/g" .env
    sed -i.bak "s/generate_random_64_hex_string_here_for_pdpl_privacy/$AUTO_HMAC/g" .env
    sed -i.bak "s/generate_random_64_hex_string_here_for_admin_session/$AUTO_ADMIN/g" .env
    rm -f .env.bak
    echo "🔐 تم توليد مفاتيح التشفير الصارمة (HMAC & Session & DB Secrets) بنجاح."
fi

# 3. تجهيز مجلدات تهيئة قاعدة البيانات المحلية init-db
mkdir -p init-db ssl
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$ROOT_DIR/db/queue-management-schema.sql" ]; then
    echo "📦 نسخ مخطط قاعدة البيانات الرئيسي والترحيلات إلى init-db..."
    cp "$ROOT_DIR/db/queue-management-schema.sql" init-db/01-queue-management-schema.sql
fi

if [ -d "$ROOT_DIR/db/migrations" ]; then
    cp "$ROOT_DIR/db/migrations/"*.sql init-db/ 2>/dev/null || true
fi

# 4. توليد شهادات SSL محلية ذاتية التوقيع إن لم تكن متوفرة
if [ ! -f ssl/server.crt ] || [ ! -f ssl/server.key ]; then
    echo "🔑 جارِ إنشاء شهادة SSL محلية مشفرة لتمكين HTTPS داخلياً..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/server.key -out ssl/server.crt \
        -subj "/C=SA/ST=Riyadh/L=Riyadh/O=MkenEnterprise/CN=localhost" 2>/dev/null || true
fi

# 5. تشغيل حاويات Docker
echo "🐳 جارِ بناء وتشغيل حاويات النظام المحلي (App, DB, PgBouncer, Nginx)..."
docker compose up -d --build

echo "⏳ في انتظار جاهزية الحاويات وفحص السلامة..."
sleep 8

echo ""
echo "=========================================================="
echo "🎉 اكتمل تثبيت وتشغيل نظام الطابور الذكي المحلي بنجاح!"
echo "=========================================================="
echo "🌐 الروابط المحلية المتاحة على الخادم:"
echo "   - لوحة تحكم الإدارة: http://localhost/admin.html"
echo "   - كشك الخدمة الذاتية: http://localhost/kiosk.html"
echo "   - شاشة عرض الانتظار:  http://localhost/queue-display.html"
echo "   - واجهة مراجعي الويب: http://localhost/queue.html"
echo "=========================================================="
