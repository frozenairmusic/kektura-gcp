# kektura-gcp

A GCP Cloud Run Function (2nd Gen) that scrapes [kektura.hu](https://kektura.hu) for GPX trail files and syncs them to a Google Cloud Storage bucket. Triggered on a schedule by Cloud Scheduler.

---

## What it does

On each invocation the function:

1. **Probes write access** to the configured storage backend — aborts immediately if the bucket is not writable.
2. **Scrapes** the listing pages for three trails: `okt`, `ak`, `rpddk`.
3. **Compares** each discovered GPX filename against `metadata.json` stored in the bucket.
4. **Downloads** only new or updated files (date embedded in the filename is used as the version).
5. **Writes** each GPX file to `gs://<bucket>/gpx/<trail>/<filename>`.
6. **Updates** `metadata.json` with the new state and a top-level `last_updated` date.
7. **Returns** a JSON summary of what was added, updated, unchanged, or errored.

Scraping is parallelised (5 subpages concurrently, 3 GPX downloads concurrently) to stay well within the 300 s function timeout.

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

## Trails scraped

| Trail | Listing URL |
|---|---|
| OKT (Országos Kéktúra) | `https://kektura.hu/okt-szakaszok` |
| AK (Alföldi Kéktúra) | `https://kektura.hu/ak-szakaszok` |
| RPDDK | `https://kektura.hu/rpddk-szakaszok` |

---

## Response format

```json
{
  "success": true,
  "summary": {
    "added": 2,
    "updated": 1,
    "unchanged": 24,
    "errors": 0,
    "duration_ms": 18400
  },
  "details": {
    "added":     ["okt_20", "okt_21"],
    "updated":   ["ak_01"],
    "unchanged": ["okt_01", "..."],
    "errors":    []
  }
}
```

On failure the function returns HTTP 500 with `{ "success": false, "error": "..." }`.

---

## Quick start

```bash
npm install

# Run tests
npm test

# Run linter
npm run lint
npm run lint:fix

# Build TypeScript
npm run build

# Run locally (no GCP needed)
LOCAL_OUTPUT_DIR=./output npm start

# Deploy manually
GCS_BUCKET_NAME=<YOUR_BUCKET_NAME> ./deploy.sh
```

---

## Documentation

| Doc | Description |
|---|---|
| [docs/gcp-setup.md](docs/gcp-setup.md) | GCP project, APIs, IAM, service accounts, Workload Identity Federation |
| [docs/local-development.md](docs/local-development.md) | Local setup, environment variables, npm scripts, project structure |
| [docs/deployment.md](docs/deployment.md) | GitHub Actions CI/CD and manual deployment via `deploy.sh` |
| [docs/scheduler.md](docs/scheduler.md) | Cloud Scheduler setup (weekly cron trigger) |
| [docs/github-setup.md](docs/github-setup.md) | GitHub Actions secrets and variables reference |

---

## Tech stack

- **Runtime** — Node.js 22, TypeScript (strict)
- **Framework** — `@google-cloud/functions-framework` (2nd Gen)
- **Storage** — `@google-cloud/storage`
- **Scraping** — `axios` + `cheerio`
- **Tests** — Jest + ts-jest + axios-mock-adapter (47 tests, 0 live network calls)
- **CI/CD** — GitHub Actions with Workload Identity Federation (no SA keys stored)
