# GCP Setup

This document covers everything needed to provision the Google Cloud infrastructure for the Kektura GPX scraper the first time.

---

## 1. Create a GCP project

```bash
gcloud projects create <YOUR_PROJECT_ID> --name="Kektura"
gcloud config set project <YOUR_PROJECT_ID>
```

Enable billing on the project in the [Cloud Console](https://console.cloud.google.com/billing).

---

## 2. Enable required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  cloudresourcemanager.googleapis.com
```

---

## 3. Create the GCS bucket

```bash
gcloud storage buckets create gs://<YOUR_BUCKET_NAME> \
  --location=europe-central2 \
  --uniform-bucket-level-access
```

---

## 4. Service accounts

### 4a. Deployer SA (used by GitHub Actions)

```bash
gcloud iam service-accounts create kektura-deployer \
  --display-name="Kektura CI/CD deployer"
```

Grant the minimum permissions needed to deploy:

```bash
PROJECT=<YOUR_PROJECT_ID>
SA=kektura-deployer@${PROJECT}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudscheduler.admin"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${SA}" \
  --role="roles/artifactregistry.writer"
```

### 4b. Scheduler SA (used by Cloud Scheduler to invoke the function)

```bash
gcloud iam service-accounts create kektura-scheduler \
  --display-name="Kektura GPX Scheduler"
```

Grant it permission to invoke the function (run after first deployment):

```bash
gcloud functions add-invoker-policy-binding sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --member="serviceAccount:kektura-scheduler@${PROJECT}.iam.gserviceaccount.com"
```

### 4c. Compute SA (Cloud Run Function runtime)

The function runs as the default Compute Engine service account. Grant it write access to the bucket:

```bash
PROJECT_NUMBER=$(gcloud projects describe <YOUR_PROJECT_ID> --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud storage buckets add-iam-policy-binding gs://<YOUR_BUCKET_NAME> \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectAdmin"
```

### 4d. Cloud Build SA

```bash
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/artifactregistry.writer"
```

---

## 5. Workload Identity Federation (for GitHub Actions)

This allows GitHub Actions to authenticate as `kektura-deployer` without storing a long-lived SA key.

```bash
PROJECT=<YOUR_PROJECT_ID>
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT} --format='value(projectNumber)')
GITHUB_ORG=<YOUR_GITHUB_ORG>
REPO=kektura-gcp

# Create the Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --project=${PROJECT} \
  --location=global \
  --display-name="GitHub Actions pool"

# Create the OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=${PROJECT} \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_ORG}/${REPO}'"

# Allow the deployer SA to be impersonated from GitHub Actions
gcloud iam service-accounts add-iam-policy-binding \
  kektura-deployer@${PROJECT}.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_ORG}/${REPO}"
```

Then note the full provider resource name for the GitHub secret:

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --project=${PROJECT} \
  --location=global \
  --workload-identity-pool=github-pool \
  --format='value(name)'
```

Copy that value into the `GCP_WORKLOAD_IDENTITY_PROVIDER` GitHub secret (see [deployment.md](./deployment.md)).

---

## 6. Summary of resources

| Resource | Name / ID |
|---|---|
| GCP Project | `<YOUR_PROJECT_ID>` |
| Project Number | `<YOUR_PROJECT_NUMBER>` |
| Region | `europe-central2` |
| GCS Bucket | `gs://<YOUR_BUCKET_NAME>` |
| Cloud Run Function | `sync-gpx-files` |
| Deployer SA | `kektura-deployer@<YOUR_PROJECT_ID>.iam.gserviceaccount.com` |
| Scheduler SA | `kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com` |
| Compute SA | `<YOUR_PROJECT_NUMBER>-compute@developer.gserviceaccount.com` |
| WIF Pool | `github-pool` |
| WIF Provider | `github-provider` |
