#!/bin/sh
# =====================================================================
# سكريبت النسخ الاحتياطي اليومي المشفر لقاعدة بيانات مَكَن المحلية
# Automated Daily Backup Script for Mken On-Premise Database
# =====================================================================

set -e

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mken_db_backup_$TIMESTAMP.sql.gz"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "💾 [$(date)] بدء إنشاء النسخة الاحتياطية لقاعدة البيانات المحلية..."

# التحقق من تشغيل حاوية قاعدة البيانات mken-db
if ! docker ps --format '{{.Names}}' | grep -q "^mken-db$"; then
    echo "❌ خطأ: حاوية قاعدة البيانات mken-db غير مشغلة حالياً."
    exit 1
fi

# تنفيذ pg_dump وضغطه مباشرة بـ gzip
docker exec -t mken-db pg_dump -U mken_admin -d mken_onprem --clean --if-exists | gzip > "$BACKUP_FILE"

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ تم إنشاء النسخة الاحتياطية بنجاح: $BACKUP_FILE (الحجم: $FILE_SIZE)"

# تدوير وحذف النسخ الاحتياطية الأقدم من 14 يوماً
echo "🧹 تنظيف النسخ الاحتياطية القديمة (أكثر من $RETENTION_DAYS يوماً)..."
find "$BACKUP_DIR" -name "mken_db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "✨ اكتملت عملية النسخ الاحتياطي والتدوير بنجاح."
