import { NextResponse } from "next/server";
import { probeGmgnOpenApiTokenInfo } from "@/lib/gmgn-openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol"]);
const DEFAULT_CHAIN = "eth";
const DEFAULT_ADDRESS = "0x44b28991b167582f18ba0259e0173176ca125505";

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      status: null,
      endpointPath: "",
      baseUsed: "",
      hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
      hasClientId: false,
      timestampPreview: null,
      contentType: null,
      gmgnCode: null,
      gmgnMessage: message,
      responsePreview: "",
      errorCode: "PROVIDER_TEST_BAD_REQUEST",
    },
    { status }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = (searchParams.get("chain") || DEFAULT_CHAIN).toLowerCase();
  const address = (searchParams.get("address") || DEFAULT_ADDRESS).trim();

  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, or sol.");
  }

  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  try {
    const diagnostics = await probeGmgnOpenApiTokenInfo({ chain, address });
    return NextResponse.json({
      ok: diagnostics.ok,
      status: diagnostics.status,
      endpointPath: diagnostics.endpointPath,
      baseUsed: diagnostics.baseUsed,
      hasGMGNKey: diagnostics.hasGMGNKey,
      hasClientId: diagnostics.hasClientId,
      timestampPreview: diagnostics.timestampPreview,
      contentType: diagnostics.contentType,
      gmgnCode: diagnostics.gmgnCode,
      gmgnMessage: diagnostics.gmgnMessage,
      responsePreview: diagnostics.responsePreview,
      errorCode: diagnostics.errorCode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: null,
        endpointPath: "/v1/token/info",
        baseUsed: "https://openapi.gmgn.ai",
        hasGMGNKey: Boolean(process.env.GMGN_API_KEY),
        hasClientId: false,
        timestampPreview: null,
        contentType: null,
        gmgnCode: null,
        gmgnMessage: error instanceof Error ? error.message : "GMGN OpenAPI provider test failed.",
        responsePreview: "",
        errorCode: "PROVIDER_TEST_EXCEPTION",
      },
      { status: 500 }
    );
  }
}
