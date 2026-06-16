import { fetchGmgnOpenApiJson } from "@/lib/gmgn-openapi";

type UnknownRecord = Record<string, unknown>;

export type GmgnRiskStats = {
  source: "gmgn-token-info";
  chain: string;
  address: string;
  top10HolderPercentage: number | null;
  insiderPercentage: number | null;
  phishingPercentage: number | null;
  bundlerPercentage: number | null;
  freshWalletPercentage: number | null;
  botDegenPercentage: number | null;
  devTeamHoldPercentage: number | null;
  creatorHoldPercentage: number | null;
  privateVaultHoldPercentage: number | null;
  top70SniperHoldPercentage: number | null;
  smartWalletCount: number | null;
  freshWalletCount: number | null;
  sniperWalletCount: number | null;
  bundlerWalletCount: number | null;
  insiderWalletCount: number | null;
  whaleWalletCount: number | null;
  renownedWalletCount: number | null;
  holderCount: number | null;
  liquidityUsd: number | null;
  totalSupply: number | null;
  circulatingSupply: number | null;
  creationTimestamp: number | null;
  price: number | null;
  volume24h: number | null;
  buyVolume24h: number | null;
  sellVolume24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  swaps24h: number | null;
  rawFieldMap: Record<string, string>;
  warnings: string[];
  raw?: unknown;
};

const SUPPORTED_GMGN_CHAINS = ["eth", "base", "bsc", "sol", "mantle"] as const;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const IS_VERCEL_RUNTIME = Boolean(process.env.VERCEL || process.env.NETLIFY);

const RATIO_FIELDS = {
  top10HolderPercentage: "stat.top_10_holder_rate",
  insiderPercentage: "stat.top_rat_trader_percentage",
  phishingPercentage: "stat.top_entrapment_trader_percentage",
  bundlerPercentage: "stat.top_bundler_trader_percentage",
  freshWalletPercentage: "stat.fresh_wallet_rate",
  botDegenPercentage: "stat.bot_degen_rate",
  devTeamHoldPercentage: "stat.dev_team_hold_rate",
  creatorHoldPercentage: "stat.creator_hold_rate",
  privateVaultHoldPercentage: "stat.private_vault_hold_rate",
  top70SniperHoldPercentage: "stat.top70_sniper_hold_rate",
} as const;

const COUNT_FIELDS = {
  smartWalletCount: "wallet_tags_stat.smart_wallets",
  freshWalletCount: "wallet_tags_stat.fresh_wallets",
  sniperWalletCount: "wallet_tags_stat.sniper_wallets",
  bundlerWalletCount: "wallet_tags_stat.bundler_wallets",
  insiderWalletCount: "wallet_tags_stat.rat_trader_wallets",
  whaleWalletCount: "wallet_tags_stat.whale_wallets",
  renownedWalletCount: "wallet_tags_stat.renowned_wallets",
} as const;

const ROOT_FIELDS = {
  holderCount: "holder_count",
  liquidityUsd: "liquidity",
  totalSupply: "total_supply",
  circulatingSupply: "circulating_supply",
  creationTimestamp: "creation_timestamp",
} as const;

const PRICE_FIELDS = {
  price: "price.price",
  volume24h: "price.volume_24h",
  buyVolume24h: "price.buy_volume_24h",
  sellVolume24h: "price.sell_volume_24h",
  buys24h: "price.buys_24h",
  sells24h: "price.sells_24h",
  swaps24h: "price.swaps_24h",
} as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function round(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function ratioToPercentage(value: unknown) {
  const numeric = asNumber(value);
  if (numeric === null) return null;
  return round(numeric <= 1 ? numeric * 100 : numeric);
}

function countValue(value: unknown) {
  const numeric = asNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function numberValue(value: unknown) {
  const numeric = asNumber(value);
  return numeric === null ? null : numeric;
}

function validateChain(chain: string) {
  if (!SUPPORTED_GMGN_CHAINS.includes(chain as (typeof SUPPORTED_GMGN_CHAINS)[number])) {
    throw new Error("Unsupported GMGN chain.");
  }
}

function isValidAddressForChain(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function validateInput(chain: string, address: string) {
  validateChain(chain);

  if (!isValidAddressForChain(chain, address)) {
    throw new Error("address must be a valid token address for the requested chain.");
  }
}

function payloadRoot(raw: unknown): { root: UnknownRecord; prefix: string } {
  if (!isRecord(raw)) return { root: {}, prefix: "" };

  if (
    isRecord(raw.data) &&
    (isRecord(raw.data.stat) ||
      isRecord(raw.data.wallet_tags_stat) ||
      raw.data.holder_count !== undefined)
  ) {
    return {
      root: raw.data,
      prefix: "data.",
    };
  }

  return {
    root: raw,
    prefix: "",
  };
}

function valueAtPath(root: UnknownRecord, path: string) {
  const parts = path.split(".");
  let current: unknown = root;

  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }

  return current;
}

function priceValue(root: UnknownRecord, path: string) {
  const nested = valueAtPath(root, path);
  if (nested !== undefined) return { value: nested, path };

  const fallbackKey = path.replace("price.", "");
  return {
    value: root[fallbackKey],
    path: fallbackKey,
  };
}

async function runGmgnTokenInfo(chain: string, address: string) {
  if (IS_VERCEL_RUNTIME) {
    throw new Error("gmgn-cli execution is disabled in Vercel serverless runtime.");
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const args = ["token", "info", "--chain", chain, "--address", address];
  const execOptions = {
    env: {
      ...process.env,
      GMGN_API_KEY: process.env.GMGN_API_KEY,
    },
    maxBuffer: 1024 * 1024 * 5,
    timeout: 30_000,
    windowsHide: true,
  };

  const { stdout } =
    process.platform === "win32"
      ? await execFileAsync("cmd.exe", ["/d", "/c", ["gmgn-cli", ...args].join(" ")], execOptions)
      : await execFileAsync("gmgn-cli", args, execOptions);

  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error("GMGN token info returned non-JSON output.");
  }
}

async function fetchGmgnTokenInfoDirect(chain: string, address: string) {
  return fetchGmgnOpenApiJson({
    failingStep: "risk-stats",
    path: "/v1/token/info",
    query: {
      chain,
      address,
    },
    source: "GMGN token info",
  });
}

function buildWarnings(result: GmgnRiskStats) {
  const warnings: string[] = [];
  const keyFields: Array<keyof GmgnRiskStats> = [
    "top10HolderPercentage",
    "insiderPercentage",
    "phishingPercentage",
    "bundlerPercentage",
    "freshWalletPercentage",
    "top70SniperHoldPercentage",
    "holderCount",
  ];

  for (const field of keyFields) {
    if (result[field] === null) {
      warnings.push(`Missing GMGN token info field for ${String(field)}.`);
    }
  }

  return warnings;
}

export async function fetchGmgnRiskStats({
  chain,
  address,
  includeRaw = false,
}: {
  chain: string;
  address: string;
  includeRaw?: boolean;
}): Promise<GmgnRiskStats> {
  validateInput(chain, address);

  const raw = IS_VERCEL_RUNTIME || process.env.GMGN_DIRECT_HTTP === "true"
    ? await fetchGmgnTokenInfoDirect(chain, address)
    : await runGmgnTokenInfo(chain, address).catch((error) => {
        if (process.env.GMGN_CLI_ONLY === "true") throw error;
        return fetchGmgnTokenInfoDirect(chain, address);
      });
  const { root, prefix } = payloadRoot(raw);
  const rawFieldMap: Record<string, string> = {};

  const result: GmgnRiskStats = {
    source: "gmgn-token-info" as const,
    chain,
    address,
    top10HolderPercentage: null,
    insiderPercentage: null,
    phishingPercentage: null,
    bundlerPercentage: null,
    freshWalletPercentage: null,
    botDegenPercentage: null,
    devTeamHoldPercentage: null,
    creatorHoldPercentage: null,
    privateVaultHoldPercentage: null,
    top70SniperHoldPercentage: null,
    smartWalletCount: null,
    freshWalletCount: null,
    sniperWalletCount: null,
    bundlerWalletCount: null,
    insiderWalletCount: null,
    whaleWalletCount: null,
    renownedWalletCount: null,
    holderCount: null,
    liquidityUsd: null,
    totalSupply: null,
    circulatingSupply: null,
    creationTimestamp: null,
    price: null,
    volume24h: null,
    buyVolume24h: null,
    sellVolume24h: null,
    buys24h: null,
    sells24h: null,
    swaps24h: null,
    rawFieldMap,
    warnings: [],
    ...(includeRaw ? { raw } : {}),
  };

  for (const [normalizedField, rawPath] of Object.entries(RATIO_FIELDS)) {
    const value = valueAtPath(root, rawPath);
    result[normalizedField as keyof typeof RATIO_FIELDS] = ratioToPercentage(value);
    rawFieldMap[normalizedField] = `${prefix}${rawPath}`;
  }

  for (const [normalizedField, rawPath] of Object.entries(COUNT_FIELDS)) {
    const value = valueAtPath(root, rawPath);
    result[normalizedField as keyof typeof COUNT_FIELDS] = countValue(value);
    rawFieldMap[normalizedField] = `${prefix}${rawPath}`;
  }

  for (const [normalizedField, rawPath] of Object.entries(ROOT_FIELDS)) {
    const value = valueAtPath(root, rawPath);
    result[normalizedField as keyof typeof ROOT_FIELDS] = numberValue(value);
    rawFieldMap[normalizedField] = `${prefix}${rawPath}`;
  }

  for (const [normalizedField, rawPath] of Object.entries(PRICE_FIELDS)) {
    const resolved = priceValue(root, rawPath);
    result[normalizedField as keyof typeof PRICE_FIELDS] = numberValue(resolved.value);
    rawFieldMap[normalizedField] = `${prefix}${resolved.path}`;
  }

  result.warnings = buildWarnings(result);

  return result;
}
