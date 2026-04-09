import { assertGeminiApiKey, getServerEnv } from "@/lib/config/env";

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

function normalizeModel(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function formatEmbeddingInput(
  text: string,
  purpose: "query" | "document",
  title?: string,
  model?: string
): string {
  // Gemini 2 preview prefers task-prefixed text for retrieval-style embeddings.
  if (model === "gemini-embedding-2-preview") {
    if (purpose === "query") {
      return `task: search result | query: ${text}`;
    }

    return `title: ${title ?? "none"} | text: ${text}`;
  }

  return text;
}

async function requestEmbedding(params: {
  apiKey: string;
  model: string;
  apiVersion: "v1" | "v1beta";
  text: string;
  purpose: "query" | "document";
  title?: string;
}): Promise<number[]> {
  const modelPath = normalizeModel(params.model);
  // Keep the REST call isolated so model/version fallbacks stay easy to reason about.
  const response = await fetch(
    `https://generativelanguage.googleapis.com/${params.apiVersion}/${modelPath}:embedContent?key=${params.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelPath,
        content: {
          parts: [
            {
              text: formatEmbeddingInput(
                params.text,
                params.purpose,
                params.title,
                params.model
              ),
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw Object.assign(new Error(`Gemini embedding request failed: ${response.status} ${errorBody}`), {
      status: response.status,
      model: params.model,
      apiVersion: params.apiVersion,
    });
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  const values = data.embedding?.values;

  if (!values || values.length === 0) {
    throw new Error("Gemini embedding response did not include vector values.");
  }

  return values;
}

export async function embedText(
  text: string,
  options: { purpose?: "query" | "document"; title?: string } = {}
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Cannot embed empty text.");
  }

  const env = getServerEnv();
  const apiKey = assertGeminiApiKey();
  const purpose = options.purpose ?? "query";
  // Try the configured model first, then fall back to the current supported embedding models.
  const models = uniqueValues([
    env.GEMINI_EMBEDDING_MODEL,
    "gemini-embedding-001",
    "gemini-embedding-2-preview",
  ]);
  const apiVersions: Array<"v1" | "v1beta"> = ["v1", "v1beta"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    let lastError: unknown = null;

    for (const apiVersion of apiVersions) {
      for (const model of models) {
        try {
          return await requestEmbedding({
            apiKey,
            model,
            apiVersion,
            text,
            purpose,
            title: options.title,
          });
        } catch (error) {
          lastError = error;

          const status =
            error instanceof Error && "status" in error
              ? Number((error as { status?: unknown }).status)
              : undefined;

          if (status !== 404) {
            throw error;
          }
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini embedding request failed for all supported model fallbacks.");
  } finally {
    clearTimeout(timeout);
  }
}
