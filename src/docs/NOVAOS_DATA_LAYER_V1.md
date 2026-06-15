# NovaOS Data Layer V1

NovaOS should treat provider responses as raw evidence, not product truth. The product layer should consume NovaOS-native wallet intelligence objects only.

Core principle:

> Do not analyze the token. Analyze the quality, behavior and conviction of the wallets behind the token.

This document defines the first backend/data-only architecture for that model. It does not introduce UI, ranking, conviction scoring, or formula changes.

## Current GMGN Surface

The integrated GMGN layer currently exposes two CLI primitives through backend-only routes:

| Capability | Current route | CLI command | Purpose |
| --- | --- | --- | --- |
| Wallet activity | `/api/gmgn/wallet-activity` | `gmgn-cli portfolio activity --chain <chain> --wallet <wallet> --limit <limit>` | First-page wallet trading/activity evidence |
| Token holders | `/api/gmgn/top-holders` | `gmgn-cli token holders --chain <chain> --address <token> --order-by amount_percentage --direction desc` | Top holders for a token |
| Deep stress test | `/api/gmgn/top100-deep-test` | Composes holders + wallet activity | Capacity and partial-failure testing |
| Deep snapshot | `/api/gmgn/top100-deep-snapshot` | Composes holders + wallet activity | First wallet-level evidence snapshot |

No smart-money endpoint, trader-ranking endpoint, wallet portfolio holdings endpoint, or funding graph endpoint is integrated yet.

## Capability Map

| NovaOS need | Availability | Source | Fields | Notes |
| --- | --- | --- | --- | --- |
| Wallet age | Derivable | Wallet activity | `timestamp` | Uses oldest returned activity timestamp. This is observed history depth, not guaranteed wallet creation age. |
| First seen / last seen | Derivable | Wallet activity | `timestamp` | Accurate only within returned history window. Pagination is required for deeper history. |
| Trade history | Available directly | Wallet activity | `event_type`, `tx_hash`, `timestamp`, `token.address`, `token.symbol`, `token_amount` | GMGN activity records provide the core behavior stream. |
| Buy/sell counts | Derivable | Wallet activity | `event_type` | Count normalized `buy` and `sell` events. |
| Trade USD values | Available directly when present | Wallet activity | `cost_usd`, `buy_cost_usd`, `price_usd` | Missing USD fields must remain null. |
| Realized PnL | Derivable | Wallet activity | `event_type`, `cost_usd`, `buy_cost_usd` | For sells only: `cost_usd - buy_cost_usd` when both fields exist. |
| Win/loss | Derivable | Wallet activity | `cost_usd`, `buy_cost_usd` | Sell comparison only. No comparison means null, not loss. |
| Win rate | Derivable | Wallet activity | `cost_usd`, `buy_cost_usd` | `winCount / (winCount + lossCount) * 100`. |
| Average hold time | Partially derivable | Wallet activity | `event_type`, `token.address`, `timestamp` | Approximate only by pairing earliest unmatched buy before sell by token address. |
| Unique tokens traded | Derivable | Wallet activity | `token.address` | Count unique token addresses only. |
| Current holding in analyzed token | Available directly | Token holders | `wallet`, `amount`, `amount_percentage`, `usd_value` | Covers the analyzed token only. |
| Full wallet holdings | Not available | None integrated | N/A | Requires wallet portfolio holdings endpoint. |
| Token history | Partially derivable | Wallet activity | `token.address`, `token.symbol`, `event_type`, `timestamp` | History exists from wallet activity, but not full market context. |
| Holder information | Available directly | Token holders | `wallet`, `amount`, `amount_percentage`, `usd_value`, `label` | Used to seed Top100 wallet analysis. |
| Smart-money information | Not available | None integrated | N/A | Do not infer smart-money identity from concentration or PnL. |
| Trader information | Partially derivable | Wallet activity | `event_type`, `timestamp`, `cost_usd`, `token.address` | Structural trader profile is possible; ranking is out of scope. |
| Funding graph | Not available | None integrated | N/A | Requires future graph/entity layer. |

## NovaOS-Native Schema

The rest of the app should not depend on GMGN field names. Provider data should be normalized into these objects in `src/lib/novaos-data-layer.ts`.

### WalletTrade

Represents one normalized wallet activity event.

Key fields:
- `wallet`
- `chain`
- `txHash`
- `timestamp`
- `eventType`
- `tokenAddress`
- `tokenSymbol`
- `tokenTotalSupply`
- `tokenAmount`
- `costUsd`
- `buyCostUsd`
- `priceUsd`
- `quoteAmount`
- `quoteSymbol`
- `gasUsd`
- `dexUsd`
- `launchpad`

### WalletHolding

Represents one current holding position.

Key fields:
- `wallet`
- `chain`
- `tokenAddress`
- `tokenSymbol`
- `tokenAmount`
- `ownershipPercentage`
- `usdValue`
- `costBasisUsd`
- `unrealizedPnlUsd`
- `label`

### WalletPerformance

Represents non-scoring performance facts, calculated only from available trade evidence.

Key fields:
- `realizedPnlUsd`
- `winCount`
- `lossCount`
- `winRate`
- `avgTradeUsd`
- `avgBuyUsd`
- `avgSellUsd`
- `avgHoldTimeSeconds`

### WalletProfile

The primary NovaOS wallet intelligence profile.

```ts
{
  wallet: string;
  ageDays: number | null;
  firstSeenTimestamp: string | null;
  lastSeenTimestamp: string | null;
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  totalBuyUsd: number;
  totalSellUsd: number;
  realizedPnlUsd: number | null;
  winCount: number | null;
  lossCount: number | null;
  winRate: number | null;
  avgTradeUsd: number | null;
  avgBuyUsd: number | null;
  avgSellUsd: number | null;
  avgHoldTimeSeconds: number | null;
  uniqueTokensTraded: number;
  currentHoldingsCount: number | null;
  confidenceLevel: "low" | "medium" | "high";
}
```

### TokenHolderSnapshot

Represents a holder of the analyzed token plus its optional wallet profile.

Key fields:
- `chain`
- `tokenAddress`
- `holderRank`
- `wallet`
- `tokenAmount`
- `ownershipPercentage`
- `usdValue`
- `label`
- `walletProfile`
- `missingData`

## Data Coverage Report

| Metric | Status | Current handling |
| --- | --- | --- |
| Wallet age | Derivable | Oldest returned activity timestamp. Null if no timestamp. |
| First seen / last seen | Derivable | Min/max returned activity timestamp. |
| Total trades | Derivable | Count normalized activity events. |
| Total buys / sells | Derivable | Count normalized event types. |
| Total buy USD / sell USD | Derivable | Sum `costUsd` for buy/sell records with USD values. |
| Realized PnL | Derivable | Sell `costUsd - buyCostUsd` only when both are numeric. |
| Win count / loss count | Derivable | Valid sell comparisons only. |
| Win rate | Derivable | Null unless at least one valid win/loss comparison exists. |
| Average trade size | Derivable | Average available `costUsd`. |
| Average hold time | Partially derivable | Approximate buy/sell timestamp pairing by token address. |
| Unique tokens traded | Derivable | Unique normalized token addresses. |
| Current holdings count | Partially derivable | Known for analyzed token holder set; full wallet holdings unavailable. |
| Entry discipline | Not available | Requires future market-cap or price-context history layer. |
| Exit discipline | Not available | Requires future market-cap or price-context history layer. |
| Consistency | Derivable later | Requires a non-scoring behavior layer over normalized trades. |
| Funding graph | Not available | Requires graph/entity layer. |
| Smart-money identity | Not available | Requires explicit source; must not be inferred. |

## Data Confidence Framework

Data confidence is not a conviction score. It describes whether a wallet profile has enough evidence to be used later.

### High

Requirements:
- At least 20 trade/activity records
- Usable timestamps
- Usable USD values
- At least one valid sell PnL comparison

### Medium

Requirements:
- At least 5 trade/activity records
- Usable timestamps
- Either usable USD values or at least one valid PnL comparison

### Low

Used when:
- No usable trade records exist
- Timestamps are missing
- USD values and PnL comparisons are unavailable
- History depth is too shallow

## V1 Boundary

Data Layer V1 may normalize and aggregate evidence. It must not:

- Rank wallets
- Produce Conviction Scores
- Infer smart-money identity
- Fill missing values with synthetic estimates
- Replace Moralis routes yet
- Connect to the terminal UI

The next safe step is to wire GMGN snapshot output into these NovaOS-native interfaces, then compare field coverage against the remaining Moralis-dependent routes before any replacement or scoring work begins.
