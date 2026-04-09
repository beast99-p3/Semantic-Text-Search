# Semantic Text Search

Semantic search app built with Next.js and Gemini embeddings.

The app embeds documents and queries, then ranks results in application code using cosine similarity and a relevance threshold.

## What’s In Here

- A curated dataset of 100 short documents across animals, programming, sports, food, travel, history, technology, and health.
- Cached indexing so embeddings are not recomputed every time the app starts.
- Cosine similarity scoring and relevance threshold filtering.
- A lightweight UI with debounced search, search history, category filtering, and an index status panel.
- API routes for search and indexing status.
- Unit and integration tests.
- Dockerfile for containerized runs.

## Good Demo Queries

Try these in the search box:

- `enterprise backend APIs`
- `indonesian island with volcanoes`
- `canines retrieving balls`
- `python dependency isolation`
- `roman water transport engineering`
- `late caffeine and sleep`

These queries are useful for checking semantic matches and ambiguity handling.

## How It Works

1. The dataset is split into chunks where needed.
2. Each chunk is embedded once and stored in a local JSON cache.
3. When a query comes in, the query is embedded with Gemini.
4. The app compares the query vector to the cached vectors using cosine similarity.
5. Results below the threshold are dropped.
6. The top matches are returned with a score and a short explanation.

## Project Structure

- Dataset: [src/lib/dataset](src/lib/dataset)
- Indexing and cache: [src/lib/indexing](src/lib/indexing)
- Search logic: [src/lib/search](src/lib/search)
- API routes: [src/app/api](src/app/api)
- Frontend UI: [src/components/search-experience.tsx](src/components/search-experience.tsx)

## Setup

### Prerequisites

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

- The app does not ask Gemini to rank or choose documents directly.
- The cache is local and human-readable.
