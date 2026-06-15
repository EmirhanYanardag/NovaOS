import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const SUPPORTED_CHAINS = new Set(["eth", "base", "bsc", "sol", "mantle"]);
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNAL_PATTERNS = {
  insiders: ["insider", "insiders", "rat", "rat_trader", "ratTrader"],
  phishing: ["phishing", "black", "blacklist", "scam"],
  bundler: ["bundler", "bundle", "bundled", "bundle_buy", "bundleBuy"],
  snipers: ["sniper", "snipers", "sniper_count", "sniperCount"],
};

type SourceProbe = {
  sourceType: "http" | "cli";
  name: string;
  commandOrUrl: string;
  ok: boolean;
  status?: number;
  error?: string;
  matchedSignals: Record<string, string[]>;
  raw?: unknown;
};

type UnknownRecord = Record<string, unknown>;

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function isValidAddress(chain: string, address: string) {
  return chain === "sol"
    ? SOL_ADDRESS_PATTERN.test(address)
    : EVM_ADDRESS_PATTERN.test(address);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function walkFields(value: unknown, path = "", seen = new Set<unknown>()) {
  const fields: { path: string; valuePreview: string }[] = [];

  if (Array.isArray(value)) {
    value.slice(0, 25).forEach((item, index) => {
      fields.push(...walkFields(item, `${path}[${index}]`, seen));
    });
    return fields;
  }

  if (!isRecord(value) || seen.has(value)) return fields;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (typeof child !== "object" || child === null) {
      fields.push({
        path: childPath,
        valuePreview: String(child).slice(0, 160),
      });
    }
    fields.push(...walkFields(child, childPath, seen));
  }

  return fields;
}

function findSignalMatches(raw: unknown) {
  const fields = walkFields(raw);
  const matchedSignals: Record<string, string[]> = {};

  for (const [signal, patterns] of Object.entries(SIGNAL_PATTERNS)) {
    const matches = fields
      .filter((field) => {
        const haystack = `${field.path} ${field.valuePreview}`.toLowerCase();
        return patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
      })
      .map((field) => `${field.path}=${field.valuePreview}`)
      .slice(0, 30);

    if (matches.length > 0) matchedSignals[signal] = matches;
  }

  return matchedSignals;
}

function gmgnHttpCandidates(chain: string, address: string) {
  const encodedChain = encodeURIComponent(chain);
  const encodedAddress = encodeURIComponent(address);
  const base = "https://gmgn.ai";

  return [
    {
      name: "token-info",
      url: `${base}/defi/quotation/v1/tokens/${encodedChain}/${encodedAddress}`,
    },
    {
      name: "token-info-v2",
      url: `${base}/defi/quotation/v2/tokens/${encodedChain}/${encodedAddress}`,
    },
    {
      name: "token-security",
      url: `${base}/defi/quotation/v1/tokens/security/${encodedChain}/${encodedAddress}`,
    },
    {
      name: "token-security-query",
      url: `${base}/defi/quotation/v1/tokens/security?chain=${encodedChain}&address=${encodedAddress}`,
    },
    {
      name: "token-risk",
      url: `${base}/defi/quotation/v1/tokens/risk/${encodedChain}/${encodedAddress}`,
    },
    {
      name: "token-holder-stat",
      url: `${base}/defi/quotation/v1/tokens/holder_stat/${encodedChain}/${encodedAddress}`,
    },
    {
      name: "token-holders",
      url: `${base}/defi/quotation/v1/tokens/top_holders/${encodedChain}/${encodedAddress}?limit=100`,
    },
    {
      name: "top-traders",
      url: `${base}/defi/quotation/v1/tokens/top_traders/${encodedChain}/${encodedAddress}?limit=100`,
    },
  ];
}

function gmgnCliCandidates(chain: string, address: string) {
  return [
    ["token", "security", "--chain", chain, "--address", address],
    ["token", "security-check", "--chain", chain, "--address", address],
    ["token", "risk", "--chain", chain, "--address", address],
    ["token", "info", "--chain", chain, "--address", address],
    ["token", "holders", "--chain", chain, "--address", address, "--order-by", "amount_percentage", "--direction", "desc"],
    ["token", "top-traders", "--chain", chain, "--address", address],
  ];
}

async function probeHttp(name: string, url: string): Promise<SourceProbe> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "NovaOS-GMGN-Source-Probe/1.0",
      },
      cache: "no-store",
    });
    const text = await response.text();
    const raw = safeJsonParse(text);

    return {
      sourceType: "http",
      name,
      commandOrUrl: url,
      ok: response.ok,
      status: response.status,
      matchedSignals: findSignalMatches(raw),
      raw,
    };
  } catch (error) {
    return {
      sourceType: "http",
      name,
      commandOrUrl: url,
      ok: false,
      error: error instanceof Error ? error.message : "HTTP probe failed.",
      matchedSignals: {},
    };
  }
}

async function probeCli(args: string[]): Promise<SourceProbe> {
  const command = `gmgn-cli ${args.join(" ")}`;
  const execOptions = {
    env: {
      ...process.env,
      GMGN_API_KEY: process.env.GMGN_API_KEY,
    },
    maxBuffer: 1024 * 1024 * 5,
    timeout: 30_000,
    windowsHide: true,
  };

  try {
    const { stdout } =
      process.platform === "win32"
        ? await execFileAsync(
            "cmd.exe",
            ["/d", "/c", ["gmgn-cli", ...args].join(" ")],
            execOptions
          )
        : await execFileAsync("gmgn-cli", args, execOptions);
    const raw = safeJsonParse(stdout);

    return {
      sourceType: "cli",
      name: args.slice(0, 2).join(" "),
      commandOrUrl: command,
      ok: true,
      matchedSignals: findSignalMatches(raw),
      raw,
    };
  } catch (error) {
    return {
      sourceType: "cli",
      name: args.slice(0, 2).join(" "),
      commandOrUrl: command,
      ok: false,
      error: error instanceof Error ? error.message : "GMGN CLI probe failed.",
      matchedSignals: {},
    };
  }
}

function summarize(probes: SourceProbe[]) {
  return Object.keys(SIGNAL_PATTERNS).map((signal) => {
    const providers = probes
      .filter((probe) => probe.matchedSignals[signal]?.length)
      .map((probe) => ({
        sourceType: probe.sourceType,
        name: probe.name,
        commandOrUrl: probe.commandOrUrl,
        status: probe.status,
        matchedFields: probe.matchedSignals[signal],
      }));

    return {
      signal,
      found: providers.length > 0,
      providers,
      inferredScope:
        providers.length > 0
          ? "raw-source-dependent; inspect matched field path and raw payload"
          : null,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain")?.toLowerCase() || "";
  const address = searchParams.get("address")?.trim() || "";
  const includeFailures = searchParams.get("includeFailures") === "true";

  if (!chain) return errorResponse("Missing chain parameter.");
  if (!SUPPORTED_CHAINS.has(chain)) {
    return errorResponse("Unsupported chain. Use eth, base, bsc, sol, or mantle.");
  }

  if (!address) return errorResponse("Missing address parameter.");
  if (!isValidAddress(chain, address)) {
    return errorResponse("address must be a valid token address for the requested chain.");
  }

  const httpProbes = await Promise.all(
    gmgnHttpCandidates(chain, address).map((candidate) =>
      probeHttp(candidate.name, candidate.url)
    )
  );
  const cliProbes = await Promise.all(
    gmgnCliCandidates(chain, address).map((args) => probeCli(args))
  );
  const probes = [...httpProbes, ...cliProbes];
  const relevantProbes = includeFailures
    ? probes
    : probes.filter((probe) => probe.ok || Object.keys(probe.matchedSignals).length > 0);

  return NextResponse.json({
    success: true,
    chain,
    address,
    purpose:
      "Raw GMGN source discovery for token-page header metrics: Insiders, Phishing, Bundler, Snipers. This route does not estimate from holder data and does not score.",
    summary: summarize(probes),
    probes: relevantProbes,
    notes: [
      "The exact source is the successful probe whose raw payload contains matching insider/phishing/bundler/sniper fields.",
      "If no probe contains a metric, the local GMGN CLI/API surface available to NovaOS has not exposed that token-page header source yet.",
      "Local shell inspection showed gmgn-cli is not currently available on PATH in this environment, but server runtime may differ.",
    ],
  });
}
