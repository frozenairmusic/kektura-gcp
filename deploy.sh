#!/usr/bin/env bash
# deploy.sh — deploy the Kektura GPX scraper to Cloud Run Functions (2nd gen)
#             and create / update the Cloud Scheduler job that triggers it.
#
# Prerequisites:
#   gcloud CLI authenticated and configured
#   A GCS bucket already created
#   A service account for Cloud Scheduler already created with
#     roles/run.invoker on the function (see README)
#
# Usage:
#   GCS_BUCKET_NAME=my-bucket SCHEDULER_SA_EMAIL=sa@project.iam.gserviceaccount.com ./deploy.sh
#   or set the variables below and run: ./deploy.sh

set -euo pipefail

# ── Required configuration ────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
REGION="${GCP_REGION:-europe-central2}"
FUNCTION_NAME="sync-gpx-files"
GCS_BUCKET="${GCS_BUCKET_NAME:?GCS_BUCKET_NAME environment variable must be set}"
SCHEDULER_SA="${SCHEDULER_SA_EMAIL:?SCHEDULER_SA_EMAIL environment variable must be set}"

# ── Optional configuration ────────────────────────────────────────────────────
RUNTIME="nodejs22"
MEMORY="256Mi"
TIMEOUT="300s"          # 5 minutes — gracious upper bound for scraping + uploads
MIN_INSTANCES="0"
MAX_INSTANCES="1"       # Scraper should not run concurrently
SCHEDULER_JOB="${SCHEDULER_JOB_NAME:-kektura-gpx-scraper}"
SCHEDULE="${SCHEDULER_SCHEDULE:-0 4 * * 3}"   # Every Wednesday at 04:00 UTC
TIMEZONE="${SCHEDULER_TIMEZONE:-UTC}"

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
  --set-build-env-vars="GOOGLE_NODE_RUN_SCRIPTS=" \
  --source=.

# Resolve the HTTPS URI of the deployed function
FUNCTION_URI="$(gcloud functions describe "${FUNCTION_NAME}" \
  --gen2 \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(serviceConfig.uri)')"

echo ""
echo "Function URI: ${FUNCTION_URI}"

# ── Cloud Scheduler — create or update ───────────────────────────────────────
echo ""
echo "Configuring Cloud Scheduler job '${SCHEDULER_JOB}'..."

SCHEDULER_ARGS=(
  --project="${PROJECT_ID}"
  --location="${REGION}"
  --schedule="${SCHEDULE}"
  --time-zone="${TIMEZONE}"
  --uri="${FUNCTION_URI}"
  --http-method=POST
  --oidc-service-account-email="${SCHEDULER_SA}"
  --oidc-token-audience="${FUNCTION_URI}"
)

if gcloud scheduler jobs describe "${SCHEDULER_JOB}" \
     --project="${PROJECT_ID}" \
     --location="${REGION}" \
     --quiet 2>/dev/null; then
  echo "  Updating existing scheduler job..."
  gcloud scheduler jobs update http "${SCHEDULER_JOB}" "${SCHEDULER_ARGS[@]}"
else
  echo "  Creating new scheduler job..."
  gcloud scheduler jobs create http "${SCHEDULER_JOB}" "${SCHEDULER_ARGS[@]}"
fi

echo ""
echo "─────────────────────────────────────────────────────"
echo "Deployment complete."
echo ""
echo "Schedule : ${SCHEDULE} ${TIMEZONE}"
echo "Job      : ${SCHEDULER_JOB}"
echo "Function : ${FUNCTION_URI}"
echo ""
echo "To trigger manually:"
echo "  gcloud functions call ${FUNCTION_NAME} --gen2 --region=${REGION}"
echo "  gcloud scheduler jobs run ${SCHEDULER_JOB} --location=${REGION}"
