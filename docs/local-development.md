# Local Development

---

## Prerequisites

| Tool | Required version |
|---|---|
| Node.js | >= 22 |
| npm | >= 10 |
| gcloud CLI | latest (optional — only needed for manual deploy) |

---

## 1. Clone and install

```bash
git clone git@github.com:<YOUR_GITHUB_ORG>/<YOUR_REPO>.git
cd kektura-gcp
npm install
```

---

## 2. Environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GCS_BUCKET_NAME` | required (or `LOCAL_OUTPUT_DIR`) | GCS bucket to write GPX files and `metadata.json` into |
| `LOCAL_OUTPUT_DIR` | required (or `GCS_BUCKET_NAME`) | Local directory to use instead of GCS — useful for offline development |
| `GPX_BASE_URL` | optional | Override the base URL for GPX downloads. Defaults to `https://turistaterkepek.hu/kekturahu/gpx/nagyszakasz` |

When **both** `LOCAL_OUTPUT_DIR` and `GCS_BUCKET_NAME` are set, `LOCAL_OUTPUT_DIR` takes precedence.

If **neither** is set the function returns HTTP 500 immediately.

### Local mode example

```dotenv
LOCAL_OUTPUT_DIR=./output
```

Running with this setting writes all files to `./output/` on disk — no GCP credentials needed.

---

## 3. npm scripts

| Script | Description |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` (uses `tsconfig.build.json`) |
| `npm start` | Build then start the Functions Framework on `http://localhost:8080` |
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run tests with code coverage report |
| `npm run lint` | ESLint (reports only) |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run deploy` | Manual deploy via `deploy.sh` (requires gcloud auth) |

---

## 4. Running locally with the Functions Framework

```bash
# .env must contain LOCAL_OUTPUT_DIR or GCS_BUCKET_NAME
npm start
```

The function is now listening at `http://localhost:8080`. Trigger it with any HTTP request:

```bash
curl http://localhost:8080
```

Or open the URL in a browser. The function always responds with JSON regardless of HTTP method or path.

---

## 5. Running tests

```bash
npm test
```

Tests are in `test/` and use Jest + ts-jest. No live network calls or GCP credentials are required — all external dependencies are mocked.

### Test files

| File | What it covers |
|---|---|
| `test/config.test.ts` | `SCRAPE_TARGETS` structure, `GPX_FILENAME_REGEX` matching rules |
| `test/scraper.test.ts` | `extractGpxLinks`, `downloadGpxFile` |
| `test/storage.test.ts` | `GcsStorageAdapter`, `LocalStorageAdapter`, `createStorageAdapter` |
| `test/index.test.ts` | Full `syncGpxFiles` handler integration (end-to-end with mocks) |
| `test/analyzer.test.ts` | `analyzeGpx`, `haversineDistance`, section computation |
| `test/helpers.ts` | Shared test utilities (`makeTempDir`, `mockReq`, `mockRes`, `htmlWithLinks`) |

```bash
# Run with coverage
npm run test:coverage
```

---

## 6. Project structure

```
src/
  analyzer.ts     GPX section analysis (stamp grouping, haversine, elevation stats)
  config.ts       Scrape targets, filename regex, concurrency limits
  index.ts        Cloud Run Function entry point (syncGpxFiles)
  scraper.ts      HTTP scraping logic (fetchSubpageUrls, extractGpxLinks, downloadGpxFile)
  storage.ts      Storage abstraction (GcsStorageAdapter, LocalStorageAdapter)
  types.ts        Shared TypeScript types (ISection, ISegmentMeta, etc.)
  utils.ts        Shared utilities (toMessage)
test/
  analyzer.test.ts
  config.test.ts
  helpers.ts
  index.test.ts
  scraper.test.ts
  storage.test.ts
deploy.sh         Manual deployment script
.env.example      Environment variable template
```
