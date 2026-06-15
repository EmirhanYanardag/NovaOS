import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalysisMode } from "@/lib/top100-holder-alpha-v3-engine";

type PrecomputedScan = Record<string, unknown>;

const PRECOMPUTED_SCAN_DIR = path.join(process.cwd(), "src", "data", "precomputed-scans");
const SAFE_CHAIN_PATTERN = /^[a-z0-9_-]{1,32}$/;
const SAFE_ADDRESS_PATTERN = /^[a-z0-9_-]{1,96}$/;

export function precomputedScanFilename(
  chain: string,
  address: string,
  analysisMode: AnalysisMode
) {
  const safeChain = chain.toLowerCase();
  const safeAddress = address.toLowerCase();

  if (!SAFE_CHAIN_PATTERN.test(safeChain) || !SAFE_ADDRESS_PATTERN.test(safeAddress)) {
    return null;
  }

  return `${safeChain}-${safeAddress}-${analysisMode}.json`;
}

export async function loadPrecomputedNovaV3Scan({
  address,
  analysisMode,
  chain,
  fallbackReason,
  requestRunId,
}: {
  address: string;
  analysisMode: AnalysisMode;
  chain: string;
  fallbackReason: string;
  requestRunId: string | null;
}) {
  const filename = precomputedScanFilename(chain, address, analysisMode);
  if (!filename) return null;

  try {
    const filePath = path.join(PRECOMPUTED_SCAN_DIR, filename);
    const raw = await readFile(filePath, "utf8");
    const scan = JSON.parse(raw) as PrecomputedScan;

    if (scan.success !== true) return null;

    return {
      ...scan,
      requestRunId: requestRunId ?? scan.requestRunId ?? null,
      dataSource: "precomputed-real-scan",
      productionFallback: true,
      fallbackReason,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}
