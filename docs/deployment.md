# Deployment

There are two ways to deploy: via **GitHub Actions** (recommended, automatic) or **manually** using `deploy.sh`.

---

## Automatic deployment — GitHub Actions

The workflow at [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs on every push to `master`:

1. Install dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Test (`npm test`)
4. Authenticate to GCP via Workload Identity Federation
5. Deploy via `bash deploy.sh`

The script also creates or updates the **Cloud Scheduler** job on every deploy (see [scheduler.md](./scheduler.md)).

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name (see [gcp-setup.md](./gcp-setup.md#5-workload-identity-federation-for-github-actions)) |
| `GCP_SERVICE_ACCOUNT` | `kektura-deployer@<YOUR_PROJECT_ID>.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` | `<YOUR_PROJECT_ID>` |
| `GCS_BUCKET_NAME` | `<YOUR_BUCKET_NAME>` |
| `GCP_SCHEDULER_SA_EMAIL` | `kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com` |

### Optional GitHub Variables

| Variable | Default | Description |
|---|---|---|
| `GCP_REGION` | `europe-central2` | GCP region for the function and scheduler |
| `SCHEDULER_JOB_NAME` | `kektura-gpx-sync` | Cloud Scheduler job name |
| `SCHEDULER_SCHEDULE` | `0 4 * * 3` | Cron expression (every Wednesday at 04:00 UTC) |
| `SCHEDULER_TIMEZONE` | `UTC` | Timezone for the cron schedule (e.g. `Europe/Budapest`) |

---

## Manual deployment — deploy.sh

Requires `gcloud` CLI authenticated with an account that has the permissions described in [gcp-setup.md](./gcp-setup.md).

```bash
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>

GCS_BUCKET_NAME=<YOUR_BUCKET_NAME> \
  SCHEDULER_SA_EMAIL=kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com \
  ./deploy.sh
```

Or export the variables first:

```bash
export GCP_PROJECT_ID=<YOUR_PROJECT_ID>
export GCP_REGION=europe-central2
export GCS_BUCKET_NAME=<YOUR_BUCKET_NAME>
export SCHEDULER_SA_EMAIL=kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com

./deploy.sh
```

### Function configuration applied by deploy.sh

| Setting | Value |
|---|---|
| Runtime | `nodejs22` |
| Entry point | `syncGpxFiles` |
| Trigger | HTTP (unauthenticated requests blocked) |
| Memory | 256 MiB |
| Timeout | 300 s |
| Min instances | 0 |
| Max instances | 1 |
| Region | `europe-central2` |
| Env var set | `GCS_BUCKET_NAME` |

---

## Triggering the function manually

```bash
# Via gcloud
gcloud functions call sync-gpx-files \
  --gen2 \
  --region=europe-central2

# Via curl with an identity token
TOKEN=$(gcloud auth print-identity-token)
URI=$(gcloud functions describe sync-gpx-files \
  --gen2 --region=europe-central2 \
  --format='value(serviceConfig.uri)')

curl -H "Authorization: Bearer ${TOKEN}" "${URI}"

# Trigger the scheduler job immediately (simulates the cron firing)
gcloud scheduler jobs run kektura-gpx-sync --location=europe-central2
```

---

## Pull request workflow

The workflow at [`.github/workflows/pr.yml`](../.github/workflows/pr.yml) runs on every pull request targeting `master`:

1. Install dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Test with coverage (`npm run test:coverage`)
4. Build TypeScript (`npm run build`)

No GCP credentials are required — the PR workflow does not deploy anything.

---

## Viewing logs

```bash
gcloud functions logs read sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --limit=50
```

Or stream live:

```bash
gcloud functions logs tail sync-gpx-files \
  --gen2 \
  --region=europe-central2
```
