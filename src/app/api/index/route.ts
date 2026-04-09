import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureIndexReady, getIndexStatus } from "@/lib/indexing/indexer";

const bodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional();

export async function POST(request: NextRequest) {
  try {
    const body = request.headers.get("content-type")?.includes("application/json")
      ? bodySchema.parse(await request.json())
      : undefined;

    await ensureIndexReady(Boolean(body?.force));
    const status = await getIndexStatus();

    return NextResponse.json(
      {
        ok: true,
        status,
      },
      { status: 200 }
    );
  } catch (error) {
    const status = await getIndexStatus();

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Indexing failed",
        status,
      },
      { status: 500 }
    );
  }
}
