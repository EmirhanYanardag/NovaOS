import { NextResponse } from "next/server";

type DexPair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  pairCreatedAt?: number;
  labels?: string[];
  baseToken?: {
    name?: string;
    symbol?: string;
    address?: string;
    logoURI?: string;
  };
  quoteToken?: {
    symbol?: string;
  };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  url?: string;
  info?: {
    header?: string;
    imageUrl?: string;
    description?: string;
    openGraph?: {
      description?: string;
      imageUrl?: string;
    };
    websites?: { label?: string; url?: string }[];
    socials?: { type?: string; url?: string }[];
    categories?: string[];
    tags?: string[];
  };
};

type SearchQuality = "strong" | "low-liquidity" | "unverified-liquidity";

function formatUsd(value?: number | string) {
  const numberValue = Number(value || 0);

  if (!numberValue) return "$0";
  if (numberValue < 0.000001) return `$${numberValue.toExponential(2)}`;
  if (numberValue < 0.01) return `$${numberValue.toFixed(8)}`;
  if (numberValue < 1) return `$${numberValue.toFixed(6)}`;
  if (numberValue >= 1_000_000_000) return `$${(numberValue / 1_000_000_000).toFixed(2)}B`;
  if (numberValue >= 1_000_000) return `$${(numberValue / 1_000_000).toFixed(2)}M`;
  if (numberValue >= 1_000) return `$${(numberValue / 1_000).toFixed(2)}K`;

  return `$${numberValue.toFixed(4)}`;
}

function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function findWebsiteUrl(websites?: { label?: string; url?: string }[]) {
  return websites?.find((website) => website.url)?.url || "";
}

function findSocialUrl(
  socials: { type?: string; url?: string }[] | undefined,
  type: string
) {
  return (
    socials?.find((social) => social.type?.toLowerCase() === type)?.url || ""
  );
}

function pairSearchQuality(pair: DexPair): SearchQuality {
  const liquidity = pair.liquidity?.usd || 0;
  const volume = pair.volume?.h24 || 0;

  if (liquidity >= 500 && volume >= 100) return "strong";
  if (liquidity > 0 || volume > 0) return "low-liquidity";
  return "unverified-liquidity";
}

function normalizePair(pair: DexPair) {
  const marketCap = pair.marketCap || pair.fdv || 0;
  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const searchQuality = pairSearchQuality(pair);

  return {
    symbol: pair.baseToken?.symbol
      ? `$${pair.baseToken.symbol.toUpperCase()}`
      : "UNKNOWN",
    rawSymbol: pair.baseToken?.symbol?.toUpperCase() || "UNKNOWN",
    name: pair.baseToken?.name || "Unknown Token",
    chain: pair.chainId || "unknown",
    dex: pair.dexId || "unknown",
    quote: pair.quoteToken?.symbol || "USD",
    price: formatUsd(pair.priceUsd),
    marketCap: formatUsd(marketCap),
    liquidity: formatUsd(liquidity),
    volume24h: formatUsd(volume24h),
    change24h: Number(pair.priceChange?.h24 || 0),
    searchQuality,
    liquidityUsd: liquidity,
    volume24hUsd: volume24h,
    pairAddress: pair.pairAddress || "",
    tokenAddress: pair.baseToken?.address || "",
    shortTokenAddress: shortAddress(pair.baseToken?.address),
    url: pair.url || "",
    imageUrl:
      pair.info?.imageUrl ||
      pair.info?.openGraph?.imageUrl ||
      pair.baseToken?.logoURI ||
      "",
    description:
      pair.info?.description || pair.info?.openGraph?.description || "",
    website: findWebsiteUrl(pair.info?.websites),
    twitter: findSocialUrl(pair.info?.socials, "twitter"),
    telegram: findSocialUrl(pair.info?.socials, "telegram"),
    categories: pair.info?.categories || [],
    tags: [...(pair.info?.tags || []), ...(pair.labels || [])],
    labels: pair.labels || [],
    metadata: {
      description:
        pair.info?.description || pair.info?.openGraph?.description || "",
      imageUrl:
        pair.info?.imageUrl ||
        pair.info?.openGraph?.imageUrl ||
        pair.baseToken?.logoURI ||
        "",
      website: findWebsiteUrl(pair.info?.websites),
      twitter: findSocialUrl(pair.info?.socials, "twitter"),
      telegram: findSocialUrl(pair.info?.socials, "telegram"),
      labels: pair.labels || pair.info?.tags || [],
      source: "dexscreener",
    },
    info: pair.info || null,
    pairCreatedAt: pair.pairCreatedAt || null,
    raw: {
      marketCap,
      liquidity,
      volume24h,
      priceUsd: Number(pair.priceUsd || 0),
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 1) {
    return NextResponse.json(
      { error: "Missing query parameter." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(
        query.trim()
      )}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "DexScreener request failed." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const pairs: DexPair[] = data?.pairs || [];

    const preferredChains = ["base", "ethereum", "solana", "mantle", "bsc"];

    const results = pairs
      .filter((pair) => {
        const hasToken = Boolean(pair.baseToken?.symbol && pair.baseToken?.address);
        const hasPair = Boolean(pair.pairAddress);
        const hasPriceOrPair = Boolean(pair.priceUsd || hasPair);

        return hasToken && hasPriceOrPair;
      })
      .sort((a, b) => {
        const qualityRank = (pair: DexPair) => {
          const quality = pairSearchQuality(pair);
          if (quality === "strong") return 2;
          if (quality === "low-liquidity") return 1;
          return 0;
        };
        const aChainScore = preferredChains.includes(a.chainId || "") ? 1 : 0;
        const bChainScore = preferredChains.includes(b.chainId || "") ? 1 : 0;

        const aLiquidity = a.liquidity?.usd || 0;
        const bLiquidity = b.liquidity?.usd || 0;

        const aVolume = a.volume?.h24 || 0;
        const bVolume = b.volume?.h24 || 0;

        const aMcap = a.marketCap || a.fdv || 0;
        const bMcap = b.marketCap || b.fdv || 0;

        return (
          qualityRank(b) - qualityRank(a) ||
          bChainScore - aChainScore ||
          bLiquidity - aLiquidity ||
          bVolume - aVolume ||
          bMcap - aMcap
        );
      })
      .slice(0, 18)
      .map(normalizePair);

    return NextResponse.json({
      results,
      best: results[0] || null,
      hasStrongPairs: results.some((result) => result.searchQuality === "strong"),
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected token search server error." },
      { status: 500 }
    );
  }
}
