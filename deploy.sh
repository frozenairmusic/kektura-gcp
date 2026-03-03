#!/usr/bin/env bash
# deploy.sh — deploy the Kektura GPX scraper to Cloud Run Functions (2nd gen)
#
# Prerequisites:
#   gcloud CLI authenticated and configured
#   A GCS bucket already created
#
# Usage:
#   GCS_BUCKET_NAME=my-bucket ./deploy.sh
#   or set the variables below and run: ./deploy.sh

set -euo pipefail

# ── Required configuration ────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-europe-central2}"
FUNCTION_NAME="sync-gpx-files"
GCS_BUCKET="${GCS_BUCKET_NAME:?GCS_BUCKET_NAME environment variable must be set}"

# ── Optional configuration ────────────────────────────────────────────────────
RUNTIME="nodejs22"
MEMORY="256Mi"
TIMEOUT="300s"          # 5 minutes — gracious upper bound for scraping + uploads
MIN_INSTANCES="0"
MAX_INSTANCES="1"       # Scraper should not run concurrently

# ─────────────────────────────────────────────────────────────────────────────

echo "Deploying '${FUNCTION_NAME}' to project '${PROJECT_ID}' in '${REGION}'..."

echo "Building TypeScript..."
npm run build

gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --runtime="${RUNTIME}" \
  --entry-point="syncGpxFiles" \
  --trigger-http \
  --no-allow-unauthenticated \
  --memory="${MEMORY}" \
  --timeout="${TIMEOUT}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --set-env-vars="GCS_BUCKET_NAME=${GCS_BUCKET}" \
  --source=.

echo ""
echo "Deployment complete."
echo ""
echo "To trigger manually:"
echo "  gcloud functions call ${FUNCTION_NAME} --gen2 --region=${REGION}"
echo ""
echo "─────────────────────────────────────────────────────"
echo "Cloud Scheduler setup (run once):"
echo ""
echo "  gcloud scheduler jobs create http kektura-gpx-scraper \\"
echo "    --schedule='0 4 * * 3' \\"
echo "    --uri=\"\$(gcloud functions describe ${FUNCTION_NAME} --gen2 --region=${REGION} --format='value(serviceConfig.uri)')\" \\"
echo "    --http-method=GET \\"
echo "    --oidc-service-account-email=<YOUR_SCHEDULER_SA>@${PROJECT_ID}.iam.gserviceaccount.com \\"
echo "    --location=${REGION}"
