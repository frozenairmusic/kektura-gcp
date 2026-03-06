# kektura-gcp

Cloud Run Function (2nd gen) that scrapes [kektura.hu](https://www.kektura.hu) for GPX trail files and syncs them to a Google Cloud Storage bucket. Triggered on a schedule by Cloud Scheduler.

---

## Table of contents

- [Architecture](#architecture)
- [Local development](#local-development)
- [One-time GCP setup](#one-time-gcp-setup)
- [GitHub repository setup](#github-repository-setup)
- [Deployment](#deployment)
- [Manual triggering](#manual-triggering)

---

## Architecture

```
GitHub Actions (push to master)
  └─▶ deploy.sh
        ├─▶ gcloud functions deploy  →  Cloud Run Function (sync-gpx-files)
        └─▶ gcloud scheduler jobs    →  Cloud Scheduler (kektura-gpx-scraper)
                                              │  fires on cron schedule
                                              ▼
                                    Cloud Run Function
                                              │  scrapes kektura.hu
                                              ▼
                                    Google Cloud Storage bucket
```

---

## Local development

```bash
npm install

# Run tests
npm test

# Run linter
npm run lint
npm run lint:fix

# Build TypeScript
npm run build

# Start local function emulator (writes to LOCAL_OUTPUT_DIR)
LOCAL_OUTPUT_DIR=./output npm start
```

---

## One-time GCP setup

Run these once per project. Replace `kektura-20260303` with your actual project ID.

### 1. Enable required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  --project=kektura-20260303
```

### 2. Create a GCS bucket

```bash
gcloud storage buckets create gs://kektura-gpx \
  --project=kektura-20260303 \
  --location=europe-central2
```

### 3. Create a service account for Cloud Scheduler

```bash
gcloud iam service-accounts create kektura-scheduler \
  --display-name="Kektura GPX Scheduler" \
  --project=kektura-20260303
```

Grant it permission to invoke the function (run after first deployment):

```bash
gcloud functions add-invoker-policy-binding sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --member="serviceAccount:kektura-scheduler@kektura-20260303.iam.gserviceaccount.com" \
  --project=kektura-20260303
```

### 4. Set up Workload Identity Federation (for GitHub Actions)

This allows GitHub Actions to authenticate to GCP without storing a long-lived key.

```bash
# Create a Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --project=kektura-20260303

# Create a provider inside the pool
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --project=kektura-20260303

# Create a deployer service account
gcloud iam service-accounts create kektura-deployer \
  --display-name="Kektura GitHub Deployer" \
  --project=kektura-20260303

# Allow this repo to impersonate it (replace with your GitHub org/repo)
gcloud iam service-accounts add-iam-policy-binding \
  kektura-deployer@kektura-20260303.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/frozenairmusic/kektura-gcp" \
  --project=kektura-20260303

# Grant the deployer the roles it needs
gcloud projects add-iam-policy-binding kektura-20260303 \
  --member="serviceAccount:kektura-deployer@kektura-20260303.iam.gserviceaccount.com" \
  --role=roles/cloudfunctions.developer
gcloud projects add-iam-policy-binding kektura-20260303 \
  --member="serviceAccount:kektura-deployer@kektura-20260303.iam.gserviceaccount.com" \
  --role=roles/run.admin
gcloud projects add-iam-policy-binding kektura-20260303 \
  --member="serviceAccount:kektura-deployer@kektura-20260303.iam.gserviceaccount.com" \
  --role=roles/cloudscheduler.admin
gcloud projects add-iam-policy-binding kektura-20260303 \
  --member="serviceAccount:kektura-deployer@kektura-20260303.iam.gserviceaccount.com" \
  --role=roles/iam.serviceAccountUser
gcloud projects add-iam-policy-binding kektura-20260303 \
  --member="serviceAccount:kektura-deployer@kektura-20260303.iam.gserviceaccount.com" \
  --role=roles/storage.admin
```

---

## GitHub repository setup

Go to **Settings → Secrets and variables → Actions** in your GitHub repository.

### Secrets

Required. Go to the **Secrets** tab and add:

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name, e.g. `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `kektura-deployer@kektura-20260303.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` | GCP project ID, e.g. `kektura-20260303` |
| `GCS_BUCKET_NAME` | GCS bucket name, e.g. `kektura-gpx` |
| `GCP_SCHEDULER_SA_EMAIL` | Scheduler SA email, e.g. `kektura-scheduler@kektura-20260303.iam.gserviceaccount.com` |

### Variables

Optional. Go to the **Variables** tab. If not set, the defaults from `deploy.sh` are used.

| Variable | Default | Description |
|---|---|---|
| `GCP_REGION` | `europe-central2` | GCP region for the function and scheduler |
| `SCHEDULER_JOB_NAME` | `kektura-gpx-scraper` | Cloud Scheduler job name |
| `SCHEDULER_SCHEDULE` | `0 4 * * 3` | Cron expression (every Wednesday at 04:00) |
| `SCHEDULER_TIMEZONE` | `UTC` | Timezone for the cron schedule (e.g. `Europe/Budapest`) |

---

## Deployment

Deployment runs automatically on every push to `master` via `.github/workflows/deploy.yml`.

To deploy manually:

```bash
export GCP_PROJECT_ID=kektura-20260303
export GCS_BUCKET_NAME=kektura-gpx
export SCHEDULER_SA_EMAIL=kektura-scheduler@kektura-20260303.iam.gserviceaccount.com

bash deploy.sh
```

---

## Manual triggering

```bash
# Invoke the function directly
gcloud functions call sync-gpx-files --gen2 --region=europe-central2

# Trigger the scheduler job immediately
gcloud scheduler jobs run kektura-gpx-scraper --location=europe-central2
```
