import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runGmgnTopHolders } from "@/lib/gmgn";

const execFileAsync = promisify(execFile);

type UnknownRecord = Record<string, unknown>;
type RiskSignal =
  | "insiderPercentage"
  | "bundlePercentage"
  | "phishingPercentage"
  | "sniperPercentage"
  | "freshWalletPercentage"
  | "smartMoneyCount"
  | "smartMoneyOwnershipShare";

type SignalSource = {
  source: "tokenHolders" | "smartMoneyHolders" | "tokenSecurity" | "topTraders";
  scope: "token-level" | "top10-level" | "top100-level" | "wallet-level";
  field: string;
};

export type GmgnRiskSignals = {
  chain: string;
  address: string;
  insiderPercentage: number | null;
  bundlePercentage: number | null;
  phishingPercentage: number | null;
  sniperPercentage: number | null;
  freshWalletPercentage: number | null;
  smartMoneyCount: number | null;
  smartMoneyOwnershipShare: number | null;
  rawSources: {
    tokenHolders?: unknown;
    smartMoneyHolders?: unknown;
    tokenSecurity?: unknown;
    topTraders?: unknown;
  };
  signalSources: Partial<Record<RiskSignal, SignalSource>>;
  availableSignals: string[];
  missingSignals: string[];
  notes: string[];
};

const SUPPORTED_GMGN_CHAINS = ["eth", "base", "bsc", "sol", "mantle"] as const;
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const SIGNALS: RiskSignal[] = [
  "insiderPercentage",
  "bundlePercentage",
  "phishingPercentage",
  "sniperPercentage",
  "freshWalletPercentage",
  "smartMoneyCount",
  "smartMoneyOwnershipShare",
];

const FIELD_VARIANTS: Record<RiskSignal, string[]> = {
  insiderPercentage: [
    "insider_percent",
    "insiderPercentage",
    "insider_rate",
    "insiderRate",
    "insider_pct",
    "insiderPct",
  ],
  bundlePercentage: [
    "bundle_percentage",
    "bundlePercentage",
    "bundle_percent",
    "bundler_percentage",
    "bundlerPercentage",
    "bundled_percent",
    "bundledPercentage",
  ],
  phishingPercentage: [
    "phishing_percent",
    "phishingPercentage",
    "phishing_rate",
    "phishingRate",
    "phishing_pct",
  ],
  sniperPercentage: [
    "sniper_percent",
    "sniperPercentage",
    "sniper_rate",
    "sniperRate",
    "sniper_pct",
  ],
  freshWalletPercentage: [
    "fresh_wallet_percentage",
    "freshWalletPercentage",
    "fresh_wallet_percent",
    "freshWalletPercent",
    "fresh_percent",
    "freshPercentage",
  ],
  smartMoneyCount: [
    "smart_money_count",
    "smartMoneyCount",
    "smart_money",
    "smartMoney",
    "smart_count",
  ],
  smartMoneyOwnershipShare: [
    "smart_money_ownership_share",
    "smartMoneyOwnershipShare",
    "smart_money_share",
    "smartMoneyShare",
    "smart_money_percentage",
    "smartMoneyPercentage",
  ],
};

const FLAG_VARIANTS = {
  insider: ["insider", "is_insider", "isInsider"],
  bundle: ["bundle", "bundled", "bundler", "is_bundler", "isBundler"],
  phishing: ["phishing", "is_phishing", "isPhishing"],
  sniper: ["sniper", "is_sniper", "isSniper"],
  fresh: ["fresh", "fresh_wallet", "freshWallet", "is_fresh", "isFresh"],
  smartMoney: [
    "smart_money",
    "smartMoney",
    "is_smart_money",
    "isSmartMoney",
    "smart",
  ],
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePercent(value: number | null) {
  if (value === null) return null;
  return Number((value <= 1 ? value * 100 : value).toFixed(4));
}

function keyMatches(key: string, variants: string[]) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return variants.some(
    (variant) => normalized === variant.toLowerCase().replace(/[^a-z0-9]/g, "")
  );
}

function findFieldDeep(
  payload: unknown,
  variants: string[],
  seen = new Set<unknown>()
): { value: number; field: string } | null {
  if (!isRecord(payload) || seen.has(payload)) return null;
  seen.add(payload);

  for (const [key, value] of Object.entries(payload)) {
    if (keyMatches(key, variants)) {
      const numeric = asNumber(value);
      if (numeric !== null) return { value: numeric, field: key };
    }
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFieldDeep(item, variants, seen);
        if (found) return found;
      }
    } else {
      const found = findFieldDeep(value, variants, seen);
      if (found) return found;
    }
  }

  return null;
}

function extractRows(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.holders,
    payload.traders,
    payload.items,
    payload.list,
    payload.rows,
    payload.result,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
    if (isRecord(candidate)) {
      const nested = extractRows(candidate);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function textBag(row: UnknownRecord) {
  return JSON.stringify(row).toLowerCase();
}

function rowHasFlag(row: UnknownRecord, variants: string[]) {
  for (const [key, value] of Object.entries(row)) {
    if (keyMatches(key, variants)) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value > 0;
      if (typeof value === "string") {
        const lowered = value.toLowerCase();
        if (["true", "yes", "1"].includes(lowered)) return true;
        if (["false", "no", "0"].includes(lowered)) return false;
      }
    }
  }

  const bag = textBag(row);
  return variants.some((variant) =>
    bag.includes(variant.toLowerCase().replace(/_/g, " "))
  );
}

function ownership(row: UnknownRecord) {
  for (const key of [
    "amount_percentage",
    "amountPercentage",
    "holding_percentage",
    "holdingPercentage",
    "percentage",
    "percent",
    "share",
  ]) {
    const value = asNumber(row[key]);
    if (value !== null) return normalizePercent(value) || 0;
  }
  return 0;
}

async function runOptionalGmgnCommand(args: string[]) {
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
      ? await execFileAsync(
          "cmd.exe",
          ["/d", "/c", ["gmgn-cli", ...args].join(" ")],
          execOptions
        )
      : await execFileAsync("gmgn-cli", args, execOptions);

  return JSON.parse(stdout) as unknown;
}

async function firstSuccessfulCommand(commands: string[][], notes: string[]) {
  for (const args of commands) {
    try {
      return {
        payload: await runOptionalGmgnCommand(args),
        command: `gmgn-cli ${args.join(" ")}`,
      };
    } catch (error) {
      notes.push(
        `GMGN command unavailable or failed: gmgn-cli ${args.join(" ")} (${
          error instanceof Error ? error.message : "unknown error"
        })`
      );
    }
  }
  return null;
}

function applyDirectSignal({
  result,
  source,
  scope,
  payload,
}: {
  result: GmgnRiskSignals;
  source: SignalSource["source"];
  scope: SignalSource["scope"];
  payload: unknown;
}) {
  for (const signal of SIGNALS) {
    if (result[signal] !== null) continue;

    const found = findFieldDeep(payload, FIELD_VARIANTS[signal]);
    if (!found) continue;

    const value =
      signal === "smartMoneyCount" ? found.value : normalizePercent(found.value);
    result[signal] = value;
    result.signalSources[signal] = {
      source,
      scope,
      field: found.field,
    };
  }
}

function applyRowSignal({
  result,
  rows,
  signal,
  variants,
  source,
  scope,
}: {
  result: GmgnRiskSignals;
  rows: UnknownRecord[];
  signal: RiskSignal;
  variants: string[];
  source: SignalSource["source"];
  scope: SignalSource["scope"];
}) {
  if (result[signal] !== null || rows.length === 0) return;

  const matched = rows.filter((row) => rowHasFlag(row, variants));
  if (matched.length === 0) return;

  const value =
    signal === "smartMoneyCount"
      ? matched.length
      : normalizePercent(matched.length / rows.length);

  result[signal] = value;
  result.signalSources[signal] = {
    source,
    scope,
    field: variants[0],
  };
}

function applySmartMoneyOwnership({
  result,
  rows,
  source,
}: {
  result: GmgnRiskSignals;
  rows: UnknownRecord[];
  source: SignalSource["source"];
}) {
  if (result.smartMoneyOwnershipShare !== null || rows.length === 0) return;

  const share = rows.some((row) => ownership(row) > 0)
    ? rows.reduce((total, row) => total + ownership(row), 0)
    : null;

  if (share === null) return;

  result.smartMoneyOwnershipShare = Number(share.toFixed(4));
  result.signalSources.smartMoneyOwnershipShare = {
    source,
    scope: source === "tokenHolders" ? "top100-level" : "wallet-level",
    field: "amount_percentage",
  };
}

function finalizeAvailability(result: GmgnRiskSignals) {
  result.availableSignals = SIGNALS.filter((signal) => result[signal] !== null);
  result.missingSignals = SIGNALS.filter((signal) => result[signal] === null);
}

export async function fetchGmgnRiskSignals({
  chain,
  address,
}: {
  chain: string;
  address: string;
}): Promise<GmgnRiskSignals> {
  validateInput(chain, address);

  const notes: string[] = [
    "Confirmed existing GMGN helper source: gmgn-cli token holders.",
    "Optional GMGN probe commands are best-effort and do not fail the route when unavailable.",
  ];
  const result: GmgnRiskSignals = {
    chain,
    address,
    insiderPercentage: null,
    bundlePercentage: null,
    phishingPercentage: null,
    sniperPercentage: null,
    freshWalletPercentage: null,
    smartMoneyCount: null,
    smartMoneyOwnershipShare: null,
    rawSources: {},
    signalSources: {},
    availableSignals: [],
    missingSignals: [],
    notes,
  };

  const tokenHolders = await runGmgnTopHolders({
    chain,
    address,
    limit: 100,
    orderBy: "amount_percentage",
    direction: "desc",
  });
  result.rawSources.tokenHolders = tokenHolders;
  const holderRows = extractRows(tokenHolders);

  applyDirectSignal({
    result,
    source: "tokenHolders",
    scope: "top100-level",
    payload: tokenHolders,
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "insiderPercentage",
    variants: FLAG_VARIANTS.insider,
    source: "tokenHolders",
    scope: "top100-level",
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "bundlePercentage",
    variants: FLAG_VARIANTS.bundle,
    source: "tokenHolders",
    scope: "top100-level",
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "phishingPercentage",
    variants: FLAG_VARIANTS.phishing,
    source: "tokenHolders",
    scope: "top100-level",
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "sniperPercentage",
    variants: FLAG_VARIANTS.sniper,
    source: "tokenHolders",
    scope: "top100-level",
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "freshWalletPercentage",
    variants: FLAG_VARIANTS.fresh,
    source: "tokenHolders",
    scope: "top100-level",
  });
  applyRowSignal({
    result,
    rows: holderRows,
    signal: "smartMoneyCount",
    variants: FLAG_VARIANTS.smartMoney,
    source: "tokenHolders",
    scope: "top100-level",
  });
  const smartRowsFromHolders = holderRows.filter((row) =>
    rowHasFlag(row, FLAG_VARIANTS.smartMoney)
  );
  applySmartMoneyOwnership({
    result,
    rows: smartRowsFromHolders,
    source: "tokenHolders",
  });

  const smartMoneyHolders = await firstSuccessfulCommand(
    [
      ["token", "smart-money-holders", "--chain", chain, "--address", address],
      ["token", "smart-money", "--chain", chain, "--address", address],
      ["smart-money", "holders", "--chain", chain, "--address", address],
    ],
    notes
  );

  if (smartMoneyHolders) {
    notes.push(`GMGN smart money source used: ${smartMoneyHolders.command}`);
    result.rawSources.smartMoneyHolders = smartMoneyHolders.payload;
    const rows = extractRows(smartMoneyHolders.payload);
    applyDirectSignal({
      result,
      source: "smartMoneyHolders",
      scope: "wallet-level",
      payload: smartMoneyHolders.payload,
    });
    if (result.smartMoneyCount === null) {
      result.smartMoneyCount = rows.length;
      result.signalSources.smartMoneyCount = {
        source: "smartMoneyHolders",
        scope: "wallet-level",
        field: "rows.length",
      };
    }
    applySmartMoneyOwnership({
      result,
      rows,
      source: "smartMoneyHolders",
    });
  }

  const tokenSecurity = await firstSuccessfulCommand(
    [
      ["token", "security", "--chain", chain, "--address", address],
      ["token", "security-check", "--chain", chain, "--address", address],
      ["security", "token", "--chain", chain, "--address", address],
    ],
    notes
  );

  if (tokenSecurity) {
    notes.push(`GMGN token security source used: ${tokenSecurity.command}`);
    notes.push("Token Security Check appears top10-limited until GMGN output proves otherwise.");
    result.rawSources.tokenSecurity = tokenSecurity.payload;
    applyDirectSignal({
      result,
      source: "tokenSecurity",
      scope: "top10-level",
      payload: tokenSecurity.payload,
    });
  }

  const topTraders = await firstSuccessfulCommand(
    [
      ["token", "top-traders", "--chain", chain, "--address", address],
      ["token", "traders", "--chain", chain, "--address", address],
      ["traders", "token", "--chain", chain, "--address", address],
    ],
    notes
  );

  if (topTraders) {
    notes.push(`GMGN top traders source used: ${topTraders.command}`);
    result.rawSources.topTraders = topTraders.payload;
    const rows = extractRows(topTraders.payload);
    applyDirectSignal({
      result,
      source: "topTraders",
      scope: "wallet-level",
      payload: topTraders.payload,
    });
    applyRowSignal({
      result,
      rows,
      signal: "insiderPercentage",
      variants: FLAG_VARIANTS.insider,
      source: "topTraders",
      scope: "wallet-level",
    });
    applyRowSignal({
      result,
      rows,
      signal: "bundlePercentage",
      variants: FLAG_VARIANTS.bundle,
      source: "topTraders",
      scope: "wallet-level",
    });
    applyRowSignal({
      result,
      rows,
      signal: "phishingPercentage",
      variants: FLAG_VARIANTS.phishing,
      source: "topTraders",
      scope: "wallet-level",
    });
    applyRowSignal({
      result,
      rows,
      signal: "sniperPercentage",
      variants: FLAG_VARIANTS.sniper,
      source: "topTraders",
      scope: "wallet-level",
    });
    applyRowSignal({
      result,
      rows,
      signal: "freshWalletPercentage",
      variants: FLAG_VARIANTS.fresh,
      source: "topTraders",
      scope: "wallet-level",
    });
    applyRowSignal({
      result,
      rows,
      signal: "smartMoneyCount",
      variants: FLAG_VARIANTS.smartMoney,
      source: "topTraders",
      scope: "wallet-level",
    });
  }

  finalizeAvailability(result);

  return result;
}
