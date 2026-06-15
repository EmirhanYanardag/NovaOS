import { NextResponse } from "next/server";
import { GMGNProviderPrimary } from "@/lib/token-data-provider";
import {
  buildCompletedTrades,
  buildTradeHistoryMetrics,
  buildWalletEvolutionMetrics,
} from "@/lib/wallet-trade-history-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function errorResponse(error: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;

  return Math.min(parsed, MAX_LIMIT);
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
  const wallet = searchParams.get("wallet")?.trim() || "";
  const limit = parseLimit(searchParams.get("limit"));

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!wallet) return errorResponse("Missing wallet parameter.");
  if (!isValidAddress(chain, wallet)) {
    return errorResponse("wallet must be a valid address for the requested chain.");
  }

  if (limit === null) return errorResponse("limit must be an integer from 1 to 100.");

  try {
    const activity = await GMGNProviderPrimary.getWalletActivity(chain, wallet, {
      limit,
    });
    const completedTrades = buildCompletedTrades(activity.data);
    const metrics = buildTradeHistoryMetrics(completedTrades);
    const walletEvolutionMetrics = buildWalletEvolutionMetrics(completedTrades);

    return NextResponse.json({
      success: true,
      chain,
      wallet,
      providerStatus: activity.status,
      providerWarnings: activity.warnings,
      rawMetrics: {
        activityCount: activity.data.length,
        buyCount: activity.data.filter((trade) => trade.eventType === "buy").length,
        sellCount: activity.data.filter((trade) => trade.eventType === "sell").length,
        transferCount: activity.data.filter((trade) => trade.eventType === "transfer").length,
        uniqueTokensTraded: new Set(
          activity.data
            .map((trade) => trade.tokenAddress)
            .filter((token): token is string => Boolean(token))
        ).size,
      },
      completedTrades,
      tradeHistoryMetrics: metrics,
      walletEvolutionMetrics,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Wallet history test request failed.",
      500
    );
  }
}
