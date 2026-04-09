import { NextResponse } from "next/server";
import { getIndexStatus } from "@/lib/indexing/indexer";

export async function GET() {
  const status = await getIndexStatus();
  return NextResponse.json({ status }, { status: 200 });
}
