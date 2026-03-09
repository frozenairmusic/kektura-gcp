# Cloud Scheduler

The function is designed to run on a schedule — once a week is sufficient since the source data (kektura.hu) does not update more frequently.

---

## 1. Create a dedicated scheduler service account

```bash
gcloud iam service-accounts create kektura-scheduler \
  --project=<YOUR_PROJECT_ID> \
  --display-name="Kektura Cloud Scheduler invoker"
```

Grant it permission to invoke the function:

```bash
FUNCTION_URI=$(gcloud functions describe sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --project=<YOUR_PROJECT_ID> \
  --format='value(serviceConfig.uri)')

gcloud functions add-invoker-policy-binding sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --member="serviceAccount:kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com"
```

---

## 2. Create the scheduler job

```bash
FUNCTION_URI=$(gcloud functions describe sync-gpx-files \
  --gen2 \
  --region=europe-central2 \
  --project=<YOUR_PROJECT_ID> \
  --format='value(serviceConfig.uri)')

gcloud scheduler jobs create http kektura-gpx-sync \
  --project=<YOUR_PROJECT_ID> \
  --location=europe-central2 \
  --schedule='0 4 * * 3' \
  --uri="${FUNCTION_URI}" \
  --http-method=POST \
  --oidc-service-account-email=kektura-scheduler@<YOUR_PROJECT_ID>.iam.gserviceaccount.com
```

This schedules the job to run every **Wednesday at 04:00 UTC**.

Cron reference: `0 4 * * 3` = minute 0, hour 4, any day-of-month, any month, Wednesday.

---

## 3. Run manually (test the scheduler job)

```bash
gcloud scheduler jobs run kektura-gpx-sync \
  --project=<YOUR_PROJECT_ID> \
  --location=europe-central2
```

---

## 4. View job status

```bash
gcloud scheduler jobs describe kektura-gpx-sync \
  --project=<YOUR_PROJECT_ID> \
  --location=europe-central2
```

---

## 5. Modify the schedule

```bash
gcloud scheduler jobs update http kektura-gpx-sync \
  --project=<YOUR_PROJECT_ID> \
  --location=europe-central2 \
  --schedule='0 4 * * 3'
```

---

## Notes

- The scheduler passes an OIDC token as the `Authorization: Bearer` header, which the function requires (it is deployed with `--no-allow-unauthenticated`).
- Cloud Scheduler retries failed jobs up to 3 times by default with exponential back-off.
- The function timeout is 300 s — well within the scheduler's maximum wait.
