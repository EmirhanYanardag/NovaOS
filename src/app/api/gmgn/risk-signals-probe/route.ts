import { NextResponse } from "next/server";
import { fetchGmgnRiskSignals } from "@/lib/gmgn-risk-signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseBoolean(value: string | null) {
  return value === "true" || value === "1";
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

export async function GET(request: Request) {
  if (!process.env.GMGN_API_KEY) {
    return errorResponse(
      "Missing GMGN_API_KEY in server environment. Add it to .env.local or .env in the project root, then restart the Next.js server.",
      500
    );
  }

  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const includeRaw = parseBoolean(searchParams.get("includeRaw"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  try {
    const signals = await fetchGmgnRiskSignals({ chain, address });

    return NextResponse.json({
      success: true,
      ...signals,
      rawSources: includeRaw ? signals.rawSources : undefined,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "GMGN risk signals probe failed.",
      500
    );
  }
}
