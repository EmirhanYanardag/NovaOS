# Moralis Replacement Plan

This is an audit and adapter plan only. It does not remove Moralis, change UI, alter scoring formulas, or change terminal behavior.

## Audit Summary

Baseline Moralis text usage count before adding this report and the provider-interface scaffold:

- Total occurrences: `218`
- Files with occurrences: `14`
- Direct Moralis HTTP endpoint call sites: `22`
- `MORALIS_API_KEY` references: `22`
- `NEXT_PUBLIC_MORALIS` references: `0`

Repro command:

```powershell
rg -n -i "moralis|NEXT_PUBLIC_MORALIS|MORALIS_API_KEY" . -g "!src/docs/MORALIS_REPLACEMENT_PLAN.md" -g "!src/lib/token-data-provider.ts"
```

`/api/token` was also audited because it is part of token selection. It does not use Moralis; it uses DexScreener search.

## Files Using Moralis

| File | Occurrences | Current Moralis role | Current data provided | GMGN replacement path | Replacement fit | Risk |
| --- | ---: | --- | --- | --- | --- | --- |
| `src/app/api/holders/route.ts` | 12 | Token owner list | Top holders, balances, ownership percentage, rough holder labels | `/api/gmgn/top-holders`, `runGmgnTopHolders`, `normalizeGmgnTopHoldersResponse` | Direct for top-holder ownership; partial for local estimated UI fields | Medium |
| `src/app/api/wallet-transactions/route.ts` | 15 | Wallet ERC20 transfer history | Wallet transfers, direction, value, token metadata, behavior summary inputs | `/api/gmgn/wallet-activity`, `runGmgnWalletActivity`, Data Layer V1 `WalletTrade` | Direct for first-page activity; partial until pagination is finalized | Medium |
| `src/app/api/wallet-memory/route.ts` | 11 | Wallet token transfer memory | Recent token transfers for a wallet/token pair, first/last timestamps, activity volume | GMGN wallet activity filtered by token address | Partial; GMGN activity needs token filter or local post-filtering | Medium |
| `src/app/api/wallet-personality/route.ts` | 17 | Single-wallet behavioral facts | Native tx age, ERC20 transfers, buy/sell/transfer behavior labels | GMGN wallet activity + Data Layer V1 `WalletProfile` | Partial; native transaction age and native balance need separate source | High |
| `src/app/api/wallet-personalities/route.ts` | 20 | Batch holder personality preview | Token owners, wallet age, ERC20 transfers, behavior preview | `/api/gmgn/top100-deep-snapshot` + `WalletProfile` | Partial; personality labels must be rebuilt after data parity | High |
| `src/app/api/wallet-profile/route.ts` | 27 | Single wallet profile | Native balance, native tx count, first/last active, token balance | Data Layer V1 profile + future GMGN portfolio holdings route | Partial; native balance and full holdings are not covered yet | High |
| `src/app/api/wallet-profiles/route.ts` | 40 | Batch profiles for holders | Token owners, native balance, native tx activity, token balance, concentration facts | GMGN top holders + top100 snapshot + future wallet holdings route | Partial; broadest Moralis dependency | High |
| `src/app/api/wallet-clusters/route.ts` | 28 | Holder clustering evidence | Token owners, native tx windows, token transfers for relationship clustering | GMGN top holders + wallet activity; future graph/funding layer | Partial; relationship/funding evidence needs new GMGN or graph route | High |
| `src/app/api/token-intelligence/route.ts` | 27 | Combined token + holder intelligence | Holder summary, wallet metadata samples, native balances, tx windows | GMGN top holders + top100 deep snapshot | Partial; token-intelligence response shape is large and UI-facing | High |
| `src/app/api/conviction-engine/route.ts` | 8 | Optional deep behavior enrichment | Moralis ERC20 transfers for holder deep behavior when `deep=true` | GMGN wallet activity + Data Layer V1 wallet profiles | Partial; do not touch until after adapter parity | High |
| `src/lib/deep-wallet-behavior.ts` | 2 | Moralis transfer normalization helper | Normalizes Moralis transfer rows into deep wallet behavior inputs | New provider-neutral trade adapter from Data Layer V1 | Partial; behavior math should consume `WalletTrade` later | Medium |
| `src/lib/cache.ts` | 7 | Moralis-specific cache metadata | Tracks expensive Moralis misses | Provider-neutral cache provider enum | Direct once provider enum includes GMGN | Low |
| `src/docs/CONVICTION_FORMULA_AUDIT.md` | 2 | Documentation only | Mentions optional Moralis dependency | Update after migration | Direct doc cleanup later | Low |
| `src/docs/NOVAOS_DATA_LAYER_V1.md` | 2 | Documentation only | Mentions Moralis replacement boundary | Keep until migration starts | Not a code dependency | Low |

## Direct Moralis Endpoint Inventory

| Moralis endpoint shape | Files | Provides | GMGN replacement |
| --- | --- | --- | --- |
| `/erc20/{tokenAddress}/owners` | `holders`, `wallet-profiles`, `wallet-personalities`, `token-intelligence`, `wallet-clusters` | Token holder addresses, balances, ownership percentages, labels | `gmgn-cli token holders`, `/api/gmgn/top-holders` |
| `/{walletAddress}/erc20/transfers` | `wallet-transactions`, `wallet-memory`, `wallet-personality`, `wallet-personalities`, `conviction-engine`, `wallet-clusters` | Wallet token transfer/activity history | `gmgn-cli portfolio activity`, `/api/gmgn/wallet-activity` |
| `/{walletAddress}` | `wallet-profile`, `wallet-profiles`, `wallet-personality`, `wallet-personalities`, `token-intelligence`, `wallet-clusters` | Native transaction count/window, first/last activity approximation | Partially replaced by GMGN activity timestamps; full native tx parity needs new GMGN route or source |
| `/{walletAddress}/balance` | `wallet-profile`, `wallet-profiles`, `token-intelligence` | Native balance | Needs new GMGN wallet/portfolio balance route or alternate provider |
| `/wallets/{walletAddress}/tokens` | `wallet-profile`, `wallet-profiles` | Wallet token balances/holdings | Needs new GMGN wallet holdings route |

## Current GMGN Replacement Coverage

| Existing GMGN layer | Replaces | Status |
| --- | --- | --- |
| `src/lib/gmgn.ts` `runGmgnTopHolders()` | Moralis token owners | Direct for holder list and ownership fields |
| `src/lib/gmgn.ts` `runGmgnWalletActivity()` | Moralis ERC20 transfers | Direct for activity stream fields GMGN returns; pagination and filtering still need hardening |
| `/api/gmgn/top-holders` | `/api/holders` raw holder source | Direct data replacement, but response shape adapter needed |
| `/api/gmgn/wallet-activity` | `/api/wallet-transactions`, wallet memory/personality transfer source | Direct activity replacement, adapter needed |
| `/api/gmgn/top100-deep-snapshot` | Batch holder + wallet evidence | Strong replacement candidate for `wallet-profiles`, `wallet-personalities`, parts of `token-intelligence` |
| `src/lib/novaos-data-layer.ts` | Provider-specific downstream objects | Provider-neutral target schema |

## Provider-Neutral Adapter Plan

Type-only scaffolding has been added in `src/lib/token-data-provider.ts`.

```ts
interface TokenDataProvider {
  name: "moralis" | "gmgn";
  status: "legacy" | "candidate" | "partial" | "planned";
  getTokenHolders(request): Promise<TokenDataProviderResult<TokenHolderSnapshot[]>>;
  getWalletTrades(request): Promise<TokenDataProviderResult<WalletTrade[]>>;
  getWalletProfile(request): Promise<TokenDataProviderResult<WalletProfile>>;
  getWalletHoldings(request): Promise<TokenDataProviderResult<WalletHolding[]>>;
}
```

### MoralisProvider Legacy

Purpose:
- Keep current routes stable.
- Wrap existing Moralis calls behind the provider interface later.
- Preserve exact response semantics until GMGN parity is proven.

Initial adapter target:
- `getTokenHolders` from Moralis owners endpoint.
- `getWalletTrades` from Moralis ERC20 transfers.
- `getWalletProfile` from native tx + balance + token balances.
- `getWalletHoldings` from `/wallets/{wallet}/tokens`.

### GMGNProvider New

Purpose:
- Become the default wallet intelligence data source.
- Return NovaOS-native `WalletTrade`, `WalletProfile`, `WalletHolding`, and `TokenHolderSnapshot` objects.
- Keep raw GMGN names inside provider adapters only.

Initial adapter target:
- `getTokenHolders` from `runGmgnTopHolders`.
- `getWalletTrades` from `runGmgnWalletActivity`.
- `getWalletProfile` from `buildWalletProfileV1`.
- `getWalletHoldings` should remain `partial` until a GMGN holdings route is integrated.

## Recommended Migration Order

1. Keep current UI routes unchanged.
2. Add a provider adapter module behind the existing GMGN test routes.
3. Build `GMGNProvider.getTokenHolders()` and compare against `/api/holders` for the same token.
4. Build `GMGNProvider.getWalletTrades()` and compare against `/api/wallet-transactions`.
5. Convert `/api/gmgn/top100-deep-snapshot` to emit Data Layer V1 `WalletProfile` objects.
6. Create a compatibility route that returns the existing `/api/holders` response shape using GMGN data only.
7. Shadow-test terminal calls with GMGN in logs or separate debug endpoints, without changing UI behavior.
8. Replace `/api/holders` provider source first because top holders have the most direct GMGN equivalent.
9. Replace wallet transfer routes next: `/api/wallet-transactions`, `/api/wallet-memory`.
10. Replace batch profile/personality routes only after native balance, full wallet holdings, and activity-window gaps are handled.
11. Touch Conviction Engine last, after every data adapter proves parity and no formula changes are required.

## Route-Level Replacement Risk

| Route | Replacement path | Fit | Risk | Why |
| --- | --- | --- | --- | --- |
| `/api/holders` | GMGN top holders | Direct | Medium | UI response includes estimated labels/scores that must remain behavior-compatible. |
| `/api/wallet-transactions` | GMGN wallet activity | Direct/partial | Medium | Activity is available, but direction/value mappings and pagination must be validated. |
| `/api/wallet-memory` | GMGN wallet activity filtered by token | Partial | Medium | Needs reliable token filter and pagination policy. |
| `/api/wallet-personality` | Data Layer V1 wallet profile | Partial | High | Current route mixes native age and transfer behavior. |
| `/api/wallet-personalities` | Top100 snapshot | Partial | High | Batch shape and behavior labels are UI-facing. |
| `/api/wallet-profile` | Wallet profile + future holdings route | Partial | High | Native balance and full token balances are missing in GMGN layer. |
| `/api/wallet-profiles` | Top100 snapshot + future holdings route | Partial | High | Largest profile surface; many fields. |
| `/api/wallet-clusters` | Top100 snapshot + future graph route | Partial | High | Relationship evidence requires graph-specific data. |
| `/api/token-intelligence` | Top100 snapshot + compatibility adapter | Partial | High | Central route feeding multiple terminal sections. |
| `/api/conviction-engine?deep=true` | Data Layer V1 wallet trades | Partial | High | Formula behavior must remain unchanged; migrate last. |

## Non-Moralis But Relevant

| File | Finding |
| --- | --- |
| `src/app/api/token/route.ts` | Uses DexScreener search, not Moralis. It should remain out of the Moralis removal work unless token-search provider strategy changes separately. |
| `src/app/terminal/page.tsx` | Calls `/api/token`, `/api/holders`, `/api/token-intelligence`, `/api/wallet-clusters`, `/api/wallet-personalities`, `/api/wallet-profiles`, `/api/wallet-transactions`, `/api/wallet-memory`, and `/api/wallet-personality`. Do not change these calls during adapter work. |

## Open Data Gaps Before Full Removal

- Full wallet holdings across all tokens.
- Native balance.
- Full native transaction count.
- Deep pagination strategy for GMGN wallet activity.
- Funding graph and relationship source.
- Explicit smart-money labels, if NovaOS ever chooses to use them.
- Compatibility mapping from GMGN-native profiles to current terminal response shapes.

## Replacement Rule

Moralis should only be removed route-by-route after:

1. A GMGN adapter returns NovaOS-native objects.
2. A compatibility layer reproduces the existing route response shape.
3. Lint/build pass.
4. Terminal behavior is verified unchanged.
5. No scoring formula is edited.
