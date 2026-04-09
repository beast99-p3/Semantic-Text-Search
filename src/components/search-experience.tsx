"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/dataset/types";
import type { IndexStatus } from "@/lib/indexing/types";
import type { SearchApiResponse } from "@/types/api";

const DEBOUNCE_MS = 350;
const MAX_QUERY_LENGTH = 300;
const HISTORY_KEY = "semantic-search-history";
const QUICK_QUERIES = [
  "enterprise backend APIs",
  "indonesian island with volcanoes",
  "canines retrieving balls",
  "python dependency isolation",
];

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function scoreBarWidth(score: number): string {
  return `${Math.max(4, Math.min(100, Math.round(score * 100)))}%`;
}

function confidenceTone(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }

  if (confidence === "medium") {
    return "bg-amber-100 text-amber-800 border-amber-300";
  }

  return "bg-zinc-100 text-zinc-700 border-zinc-300";
}

function loadSearchHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(items: string[]): void {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

interface QueryFeedback {
  normalizedQuery: string;
  warnings: string[];
  error?: string;
}

function validateClientQuery(rawQuery: string): QueryFeedback {
  const normalizedQuery = rawQuery.trim().replace(/\s+/g, " ");
  const warnings: string[] = [];

  if (!rawQuery) {
    return { normalizedQuery, warnings };
  }

  if (!normalizedQuery) {
    return {
      normalizedQuery,
      warnings,
      error: "Query cannot be only spaces.",
    };
  }

  if (normalizedQuery.length > MAX_QUERY_LENGTH) {
    return {
      normalizedQuery,
      warnings,
      error: `Query is too long. Keep it under ${MAX_QUERY_LENGTH} characters.`,
    };
  }

  if (/^[\p{P}\p{S}\s]+$/u.test(normalizedQuery)) {
    return {
      normalizedQuery,
      warnings,
      error: "Use at least some letters or numbers in your query.",
    };
  }

  const letters = [...normalizedQuery.matchAll(/\p{L}/gu)].length;
  const latinLetters = [...normalizedQuery.matchAll(/\p{Script=Latin}/gu)].length;
  const symbols = [...normalizedQuery.matchAll(/[\p{P}\p{S}]/gu)].length;

  if (normalizedQuery.length > 220) {
    warnings.push("Long queries may reduce precision. Try shortening the sentence.");
  }

  if (normalizedQuery.length > 0 && symbols / normalizedQuery.length > 0.3) {
    warnings.push("Query includes many special characters. Results may be less stable.");
  }

  if (letters > 0 && latinLetters / letters < 0.4) {
    warnings.push("Non-English query detected. Search is supported, but quality may vary by language.");
  }

  return {
    normalizedQuery,
    warnings,
  };
}

export function SearchExperience() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "all">("all");
  const [history, setHistory] = useState<string[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [searchData, setSearchData] = useState<SearchApiResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchWarnings, setSearchWarnings] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  const refreshIndexStatus = useCallback(async () => {
    // Keep the side panel honest even if indexing happens in another tab or session.
    const response = await fetch("/api/index/status");
    const body = (await response.json()) as { status: IndexStatus };
    setIndexStatus(body.status);
  }, []);

  const runIndex = useCallback(
    async (force = false) => {
      setIsIndexing(true);
      setSearchError(null);

      try {
        const response = await fetch("/api/index", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ force }),
        });

        const body = (await response.json()) as { status: IndexStatus; error?: string };

        if (!response.ok) {
          throw new Error(body.error ?? "Indexing failed");
        }

        setIndexStatus(body.status);
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : "Indexing failed");
      } finally {
        setIsIndexing(false);
      }
    },
    []
  );

  useEffect(() => {
    // Search history is a local convenience, so we only load it once on mount.
    setHistory(loadSearchHistory());
    refreshIndexStatus().catch((error) => {
      setSearchError(error instanceof Error ? error.message : "Failed to load index status");
    });
  }, [refreshIndexStatus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      if (debouncedQuery.length > 0) {
        setSearchError("Query cannot be only spaces.");
        setSearchWarnings([]);
      }
      setSearchData(null);
      if (debouncedQuery.length === 0) {
        setSearchError(null);
      }
      return;
    }

    const feedback = validateClientQuery(debouncedQuery);
    if (feedback.error) {
      setSearchData(null);
      setSearchError(feedback.error);
      setSearchWarnings(feedback.warnings);
      return;
    }

    const controller = new AbortController();

    const search = async () => {
      // Debounce keeps the API from firing on every keystroke.
      setIsSearching(true);
      setSearchError(null);
      setSearchWarnings(feedback.warnings);

      try {
        const params = new URLSearchParams({ q: feedback.normalizedQuery, k: "8" });
        if (category !== "all") {
          params.set("category", category);
        }

        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Search request failed");
        }

        const typed = body as SearchApiResponse;
        setSearchData(typed);
        setIndexStatus(typed.indexing);
        setSearchWarnings(typed.warnings ?? feedback.warnings);

        setHistory((prev) => {
          const next = [feedback.normalizedQuery, ...prev.filter((item) => item !== feedback.normalizedQuery)].slice(0, 12);
          saveSearchHistory(next);
          return next;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchError(error instanceof Error ? error.message : "Unexpected search error");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    search();

    return () => controller.abort();
  }, [debouncedQuery, category]);

  const removeHistoryItem = useCallback((itemToRemove: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item !== itemToRemove);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setSearchData(null);
    setSearchError(null);
    setSearchWarnings([]);
    inputRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-295 px-4 py-8 sm:px-8 sm:py-12">
      <section className="animate-rise-in grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="frost-panel rounded-2xl p-5">
          <h2 className="text-lg font-semibold tracking-tight">Search History</h2>
          <p className="ink-muted mt-1 text-sm">Re-run a previous query or remove anything you do not need.</p>

          <div className="mt-4 space-y-2">
            {history.length === 0 && (
              <p className="ink-muted rounded-xl border border-dashed border-zinc-300 p-3 text-sm">
                No recent searches yet.
              </p>
            )}
            {history.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 px-3 py-2"
              >
                <button
                  onClick={() => setQuery(item)}
                  className="min-w-0 flex-1 text-left text-sm hover:text-(--accent-1)"
                >
                  <span className="block truncate">{item}</span>
                </button>
                <button
                  onClick={() => removeHistoryItem(item)}
                  aria-label={`Delete history item ${item}`}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-300 bg-white/70 p-4">
            {/* Index health snapshot from the backend status endpoint. */}
            <h3 className="text-sm font-semibold">Index Status</h3>
            <p className="ink-muted mt-1 text-xs">
              {indexStatus?.ready ? "Ready for semantic search" : "Not indexed yet"}
            </p>
            <div className="mt-3 space-y-1 text-xs">
              <p>Documents: {indexStatus?.documentCount ?? "-"}</p>
              <p>Chunks: {indexStatus?.chunkCount ?? "-"}</p>
              <p>Model: {indexStatus?.model ?? "-"}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => runIndex(false)}
                disabled={isIndexing}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold hover:border-zinc-500 disabled:opacity-60"
              >
                {isIndexing ? "Indexing..." : "Index dataset"}
              </button>
              <button
                onClick={() => runIndex(true)}
                disabled={isIndexing}
                className="rounded-lg bg-(--accent-2) px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Force re-index
              </button>
            </div>
          </div>
        </aside>

        <section className="frost-panel rounded-2xl p-5 sm:p-7">
          <header className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-(--ink-2)">
              Semantic text search
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Find related documents by meaning, not by exact words
            </h1>
            <p className="ink-muted max-w-3xl text-sm">
              Gemini only creates embeddings here. The app stores them locally, compares vectors in
              code, and filters weak matches with a threshold so the results stay useful.
            </p>
          </header>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try 'backend language for enterprise APIs'"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-18 text-sm outline-none focus:border-(--accent-1)"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                <span className="kbd">/</span>
              </span>
            </label>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentCategory | "all")}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-(--accent-1)"
            >
              <option value="all">All categories</option>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="ink-muted text-xs">Quick examples:</span>
            {QUICK_QUERIES.map((sample) => (
              <button
                key={sample}
                onClick={() => setQuery(sample)}
                className="rounded-full border border-zinc-300 bg-white/80 px-3 py-1 text-xs hover:border-(--accent-1) hover:text-(--accent-1)"
              >
                {sample}
              </button>
            ))}
            {query.trim() && (
              <button
                onClick={clearSearch}
                className="rounded-full border border-zinc-300 bg-zinc-100/80 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-500"
              >
                Clear
              </button>
            )}
          </div>

          {isSearching && (
            <div className="mt-5 grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white/70"
                />
              ))}
            </div>
          )}

          {searchError && (
            <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {searchError}
            </div>
          )}

          {!searchError && searchWarnings.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              {searchWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          {!isSearching && !searchError && !searchData && (
            <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-5 text-sm ink-muted">
              Enter a query to search the indexed dataset by meaning.
            </div>
          )}

          {!isSearching && !searchError && searchData && searchData.results.length === 0 && (
            <div className="mt-6 rounded-xl border border-zinc-300 bg-white/70 p-5 text-sm ink-muted">
              No semantic matches crossed the relevance threshold. Try a clearer query or a lower
              threshold in the API call.
            </div>
          )}

          {!isSearching && searchData && searchData.results.length > 0 && (
            <div className="mt-6 grid gap-4">
              {searchData.results.map((result, index) => (
                <article
                  key={result.id}
                  className="animate-rise-in rounded-2xl border border-zinc-300 bg-white/85 p-4"
                  style={{ animationDelay: `${index * 35}ms` }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{result.title}</h3>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-700">
                      {result.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceTone(
                        result.confidence
                      )}`}
                    >
                      {result.confidence} confidence
                    </span>
                  </div>
                  <p className="ink-muted mt-2 text-sm">{result.text}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-(--accent-1) transition-all"
                      style={{ width: scoreBarWidth(result.score) }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="ink-muted">Semantic score: {result.score.toFixed(4)}</span>
                    <span className="ink-muted">{result.explanation}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {searchData && (
            // Show result count, latency, and active index model for quick feedback.
            <section className="mt-7 rounded-xl border border-zinc-300 bg-white/70 p-4 text-xs ink-muted">
              <p>
                Found {searchData.results.length} semantic result
                {searchData.results.length === 1 ? "" : "s"} in {searchData.tookMs}ms.
              </p>
              <p className="mt-1">
                Index ready: {searchData.indexing.ready ? "yes" : "no"} | Model: {searchData.indexing.model}
              </p>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
