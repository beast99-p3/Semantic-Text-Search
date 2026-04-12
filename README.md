# Semantic Text Search

Semantic search app built with Next.js and Gemini embeddings.

The app embeds documents and queries, ranks results in application code with cosine similarity, and filters by relevance threshold.

## Included

- 104 short documents across animals, programming, sports, food, travel, history, technology, and health.
- Local embedding cache so the index is reused between runs.
- Search UI with live query updates, history, category filtering, and an adjustable threshold.
- API routes for search and index status.
- Unit and integration tests.
- Dockerfile for container runs.

## Sample Queries

Use these in the search box:

- `enterprise backend APIs`
- `indonesian island with volcanoes`
- `canines retrieving balls`
- `python dependency isolation`
- `roman water transport engineering`
- `late caffeine and sleep`

These are useful for checking semantic matches and ambiguity handling.

The dataset also includes ambiguity pairs such as:

- `Java island tourism` vs `Java programming language`
- `Apple fruit nutrition` vs `Apple stock price`

## How It Works

1. The dataset is split into chunks where needed.
2. Each chunk is embedded once and stored in a local JSON cache.
3. Queries are embedded with Gemini when they arrive.
4. The app compares query vectors to cached vectors with cosine similarity.
5. Results below the threshold are filtered out.
6. The top matches are returned with a score and short explanation.

## Project Structure

- Dataset: [src/lib/dataset](src/lib/dataset)
- Indexing and cache: [src/lib/indexing](src/lib/indexing)
- Search logic: [src/lib/search](src/lib/search)
- API routes: [src/app/api](src/app/api)
- Frontend UI: [src/components/search-experience.tsx](src/components/search-experience.tsx)

## Setup

### Requirements

- Node.js 20+
- A Gemini API key

### Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npm run test
```

### Build for production

```bash
npm run build
```

### Docker

```bash
docker build -t semantic-text-search .
docker run --rm -p 3000:3000 --env-file .env.local semantic-text-search
```

## API Summary

- `GET /api/search?q=...` returns ranked semantic results.
- `POST /api/index` rebuilds the cache if needed.
- `GET /api/index/status` reports whether the index is ready.

## Notes

- Gemini is used for embeddings only; ranking happens in the app.
- The cache is local JSON.
- Default threshold is `0.62` (configurable with `SEMANTIC_RELEVANCE_THRESHOLD`).
- Cache invalidation is dataset-hash based and can also be forced via `POST /api/index`.
