# kektura-gcp

Cloud Run Function (2nd gen) that scrapes [kektura.hu](https://www.kektura.hu) for GPX trail files and syncs them to a Google Cloud Storage bucket. Triggered on a schedule by Cloud Scheduler.

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

## Further documentation

- [docs/gcp-setup.md](docs/gcp-setup.md) — one-time GCP infrastructure setup (APIs, bucket, service accounts, Workload Identity Federation)
- [docs/github-setup.md](docs/github-setup.md) — GitHub Actions secrets and variables reference
- [docs/deployment.md](docs/deployment.md) — automatic and manual deployment, manual function triggering
