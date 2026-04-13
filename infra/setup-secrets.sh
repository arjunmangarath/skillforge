#!/usr/bin/env bash
# Run this ONCE to create all required secrets in Google Secret Manager.
# Usage: PROJECT_ID=your-project-id bash infra/setup-secrets.sh

set -euo pipefail
PROJECT=${PROJECT_ID:?Set PROJECT_ID}

echo "Creating secrets in project: $PROJECT"

create_secret() {
  local name="$1"
  local prompt="$2"
  echo -n "$prompt: "
  read -rs value
  echo
  if gcloud secrets describe "$name" --project="$PROJECT" &>/dev/null; then
    echo "  ↻ Updating $name"
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT"
  else
    echo "  + Creating $name"
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT" --replication-policy=automatic
  fi
}

# AlloyDB connection string — postgresql+asyncpg://user:pass@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE
create_secret "alloydb-url"            "AlloyDB connection URL (postgresql+asyncpg://...)"
create_secret "google-client-id"       "Google OAuth Client ID"
create_secret "google-client-secret"   "Google OAuth Client Secret"

echo ""
echo "Done. Grant Cloud Run service account access:"
echo ""
echo "  SA=\$(gcloud run services describe skillforge-backend --region=us-central1 --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo 'SERVICE_ACCOUNT@$PROJECT.iam.gserviceaccount.com')"
echo "  for secret in alloydb-url google-client-id google-client-secret; do"
echo "    gcloud secrets add-iam-policy-binding \$secret --member=\"serviceAccount:\$SA\" --role=roles/secretmanager.secretAccessor --project=$PROJECT"
echo "  done"
