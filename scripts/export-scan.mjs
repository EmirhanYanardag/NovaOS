import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://localhost:3000";
const VALID_MODES = new Set(["fast", "balanced", "deep"]);

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function usage() {
  console.error([
    "Usage:",
    "  npm run export:scan -- --chain eth --address 0x... --mode fast",
    "",
    "Optional:",
    "  --base-url http://localhost:3000",
    "  --forceRefresh true",
    "",
    "This writes only successful real Nova V3 route responses to src/data/precomputed-scans/.",
  ].join("\n"));
}

const chain = argValue("chain")?.toLowerCase();
const address = argValue("address")?.toLowerCase();
const mode = argValue("mode", "fast")?.toLowerCase();
const baseUrl = argValue("base-url", process.env.NOVAOS_BASE_URL || DEFAULT_BASE_URL);
const forceRefresh = argValue("forceRefresh", "true");

if (!chain || !address || !VALID_MODES.has(mode)) {
  usage();
  process.exit(1);
}

const params = new URLSearchParams({
  chain,
  address,
  analysisMode: mode,
  forceRefresh,
  runId: `export-${Date.now()}`,
});
const url = `${baseUrl.replace(/\/+$/, "")}/api/scoring/nova-conviction-v3-test?${params.toString()}`;
const response = await fetch(url, { cache: "no-store" });
const text = await response.text();

let json;
try {
  json = JSON.parse(text);
} catch {
  console.error(`Nova V3 export failed: route returned non-JSON HTTP ${response.status}.`);
  console.error(text.slice(0, 300));
  process.exit(1);
}

if (!response.ok || json?.success !== true) {
  console.error(`Nova V3 export failed: HTTP ${response.status}.`);
  console.error(JSON.stringify(json, null, 2).slice(0, 1200));
  process.exit(1);
}

delete json.dataSource;
delete json.productionFallback;
delete json.fallbackReason;

const dir = path.join(process.cwd(), "src", "data", "precomputed-scans");
const filename = `${chain}-${address}-${mode}.json`;
const filePath = path.join(dir, filename);

await mkdir(dir, { recursive: true });
await writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf8");

console.log(`Saved real Nova V3 scan: ${filePath}`);
