# Deployment

---

## Automatic deployment

Deployment runs automatically on every push to `master` via `.github/workflows/deploy.yml`.

The workflow:
1. Runs lint and tests
2. Authenticates to GCP via Workload Identity Federation
3. Runs `deploy.sh` which deploys the function and creates/updates the Cloud Scheduler job

---

## Manual deployment

```bash
export GCP_PROJECT_ID=kektura-20260303
export GCS_BUCKET_NAME=kektura-gpx
export SCHEDULER_SA_EMAIL=kektura-scheduler@kektura-20260303.iam.gserviceaccount.com

bash deploy.sh
```

---

## Manual triggering

```bash
# Invoke the function directly via gcloud
gcloud functions call sync-gpx-files --gen2 --region=europe-central2

# Trigger the scheduler job immediately (simulates the cron firing)
gcloud scheduler jobs run kektura-gpx-scraper --location=europe-central2
```
