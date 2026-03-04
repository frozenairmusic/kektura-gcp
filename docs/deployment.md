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

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** in the `<YOUR_GITHUB_ORG>/<YOUR_REPO>` repository and add:

| Secret | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name (see [gcp-setup.md](./gcp-setup.md#5-workload-identity-federation-for-github-actions)) |
| `GCP_SERVICE_ACCOUNT` | `kektura-deployer@<YOUR_PROJECT_ID>.iam.gserviceaccount.com` |
| `GCP_PROJECT_ID` | `<YOUR_PROJECT_ID>` |
| `GCS_BUCKET_NAME` | `<YOUR_BUCKET_NAME>` |

### Required GitHub Variables

| Variable | Value |
|---|---|
| `GCP_REGION` | `europe-central2` |

---

## Manual deployment — deploy.sh

Requires `gcloud` CLI authenticated with an account that has the permissions described in [gcp-setup.md](./gcp-setup.md).

```bash
gcloud auth login
gcloud config set project <YOUR_PROJECT_ID>

GCS_BUCKET_NAME=<YOUR_BUCKET_NAME> ./deploy.sh
```

Or export the variables first:

```bash
export GCP_PROJECT_ID=<YOUR_PROJECT_ID>
export GCP_REGION=europe-central2
export GCS_BUCKET_NAME=<YOUR_BUCKET_NAME>

./deploy.sh
```

The script will:

1. Compile TypeScript (`npm run build`)
2. Run `gcloud functions deploy sync-gpx-files ...`

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
gcloud functions call sync-gpx-files \
  --gen2 \
  --region=europe-central2
```

Or via `curl` with an identity token:

```bash
TOKEN=$(gcloud auth print-identity-token)
URI=$(gcloud functions describe sync-gpx-files \
  --gen2 --region=europe-central2 \
  --format='value(serviceConfig.uri)')

curl -H "Authorization: Bearer ${TOKEN}" "${URI}"
```

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
