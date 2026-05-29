import { NextResponse } from "next/server";
import {
  getCacheEntriesPreview,
  getCacheStats,
  resetCacheStats,
} from "../../../lib/cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resetRequested = searchParams.get("reset") === "true";

  if (resetRequested && process.env.NODE_ENV !== "production") {
    resetCacheStats();
  }

  return NextResponse.json({
    stats: getCacheStats(),
    entriesPreview: getCacheEntriesPreview(),
    generatedAt: new Date().toISOString(),
    resetApplied: resetRequested && process.env.NODE_ENV !== "production",
    resetAllowed: process.env.NODE_ENV !== "production",
  });
}
