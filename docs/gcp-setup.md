# One-time GCP setup

Run these commands once per project. Replace `kektura-20260303` with your actual project ID.

---

## 1. Enable required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  --project=kektura-20260303
```

---

## 2. Create a GCS bucket

```bash
gcloud storage buckets create gs://kektura-gpx \
  --project=kektura-20260303 \
  --location=europe-central2
```

---

## 3. Create a service account for Cloud Scheduler

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

---

## 4. Set up Workload Identity Federation (for GitHub Actions)

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
