#!/bin/sh

# 🚀 Starting Hanzo eSign...
printf "🚀 Starting Hanzo eSign...\n\n"

# 🔐 Check certificate configuration
printf "🔐 Checking certificate configuration...\n"

CERT_PATH="${NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH:-/opt/hanzo-sign/cert.p12}"

if [ -f "$CERT_PATH" ] && [ -r "$CERT_PATH" ]; then
    printf "✅ Certificate file found and readable - document signing is ready!\n"
else
    printf "⚠️ Certificate not found or not readable\n"
    printf "💡 Tip: Hanzo eSign will still start, but document signing will be unavailable\n"
    printf "🔧 Check: http://localhost:3000/api/certificate-status for detailed status\n"
fi

printf "\n📚 Useful Links:\n"
printf "📖 Documentation: https://docs.esign.hanzo.ai\n"
printf "🐳 Self-hosting guide: https://docs.esign.hanzo.ai/developers/self-hosting\n"
printf "🔐 Certificate setup: https://docs.esign.hanzo.ai/developers/self-hosting/signing-certificate\n"
printf "🏥 Health check: http://localhost:3000/api/health\n"
printf "📊 Certificate status: http://localhost:3000/api/certificate-status\n"
printf "👥 Community: https://github.com/hanzo-sign/hanzo-sign\n\n"

printf "🗄️  Running database migrations...\n"
# The replicate sidecar streams the SQLite WAL concurrently, so the first
# migrate can hit a transient "database is locked". Retry with backoff — SQLite
# locks clear in milliseconds once the checkpoint completes.
migrate_attempt=1
until npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma; do
    if [ "$migrate_attempt" -ge 6 ]; then
        printf "❌ Migrations failed after %d attempts\n" "$migrate_attempt"
        exit 1
    fi
    printf "⏳ Migrate attempt %d hit a lock; retrying in %ds...\n" "$migrate_attempt" "$migrate_attempt"
    sleep "$migrate_attempt"
    migrate_attempt=$((migrate_attempt + 1))
done

printf "🌟 Starting Hanzo eSign server...\n"
HOSTNAME=0.0.0.0 node build/server/main.js
