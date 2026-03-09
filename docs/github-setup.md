# GitHub repository setup

Go to **Settings → Secrets and variables → Actions** in your GitHub repository.

---

## Secrets

Required. Go to the **Secrets** tab and add:

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full provider resource name, e.g. `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Deployer SA email, e.g. `kektura-deployer@my-kektura-project.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` | GCP project ID, e.g. `my-kektura-project` |
| `GCS_BUCKET_NAME` | GCS bucket name, e.g. `kektura-gpx-bucket` |
| `GCP_SCHEDULER_SA_EMAIL` | Scheduler SA email, e.g. `kektura-scheduler@my-kektura-project.iam.gserviceaccount.com` |

---

## Variables

Optional. Go to the **Variables** tab. If not set, the defaults from `deploy.sh` are used.

| Variable | Default | Description |
|---|---|---|
| `GCP_REGION` | `europe-central2` | GCP region for the function and scheduler |
| `SCHEDULER_JOB_NAME` | `kektura-gpx-sync` | Cloud Scheduler job name |
| `SCHEDULER_SCHEDULE` | `0 4 * * 3` | Cron expression (every Wednesday at 04:00 UTC) |
| `SCHEDULER_TIMEZONE` | `UTC` | Timezone for the cron schedule (e.g. `Europe/Budapest`) |
