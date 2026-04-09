import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/config/env";
import type { EmbeddingCache } from "@/lib/indexing/types";

function cacheFilePath(): string {
  const env = getServerEnv();
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.CACHE_PATH);
}

export async function readEmbeddingCache(): Promise<EmbeddingCache | null> {
  const filePath = cacheFilePath();

  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as EmbeddingCache;
  } catch {
    return null;
  }
}

export async function writeEmbeddingCache(cache: EmbeddingCache): Promise<void> {
  const filePath = cacheFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf-8");
}

export function getEmbeddingCachePath(): string {
  return cacheFilePath();
}
