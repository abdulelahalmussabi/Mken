#!/bin/sh
# =====================================================================
# تهيئة قاعدة البيانات المحلية عند أول تشغيل لحاوية PostgreSQL
# Initial Schema & Migrations Loader for On-Premise PostgreSQL
# =====================================================================

set -e

echo "📦 تهيئة جداول منصة مَكَن ونظام الطوابير والتراخيص المحلية..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "✅ تم تفعيل إضافات التشفير والـ UUIDs بنجاح."
