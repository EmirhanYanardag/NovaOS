# Conviction Formula Audit

## 1. Executive Summary

NovaOS currently has one authoritative final conviction formula: `calculateFinalConvictionScore` in `src/lib/conviction-engine.ts`. It is called from `calculateConvictionEngine`, which is exposed through `/api/conviction-engine` and then bundled by `/api/analyze-token`.

The current final score is still a V1 score. It directly weights six core subscores:

- Holder Integrity: 22%
- Wallet Quality: 18%
- Behavior Stability: 18%
- Liquidity Trust: 15%
- Market Momentum: 12%
- Risk Protection: 15%

The newer intelligence layers are not all part of that final formula. Deep Wallet Behavior V1 and Funding & Bundle Detection V1 can affect the final score, but mostly through enrichment of the old V1 input shape and through severe caps. Wallet Reputation Engine V1, Holder Intelligence Matrix V2, Insider Mathematics V2, Wallet Flow Mathematics V2, Signals, Watchlist, History, and AI vs Human are currently UI/client-level consumers or explanations. They do not feed back into `calculateFinalConvictionScore`.

The most important product implication: the terminal can show sophisticated V2 intelligence while the headline final conviction score still mostly reflects holder rows, wallet profiles, cluster summary, market data, optional deep transfer enrichment, and optional bundle fields.

## 2. Current Score Pipeline

### Selection to unified analysis

Frontend token selection starts in `selectToken` in `src/app/terminal/page.tsx`. It resets local terminal state and calls `loadUnifiedTokenAnalysis(result)`.

`loadUnifiedTokenAnalysis` calls `/api/analyze-token` with:

- `chain`
- `tokenAddress`
- `tokenSymbol`
- `limit`
- `mode`
- `deepLimit` when mode is deep
- market params when available

Output is normalized into terminal state:

- `holders`
- `walletProfiles`
- `clusters`
- `tokenIntelligence`
- `conviction`
- `walletPersonalities`
- `warnings`
- per-module load states

The final conviction object lands in `explainableConviction` via `setExplainableConviction(normalizedConviction)`. A local history snapshot is then recorded by `recordConvictionSnapshot`.

Caching:

- `/api/analyze-token` uses `getOrSetCache`.
- Standard cache TTL is 300 seconds.
- Deep cache TTL is 900 seconds.
- Cache key includes route, chain, token address, token symbol, pair address, mode, limit, deep limit, personality limit, and bucketed market inputs.

Optional/required:

- `chain` and `tokenAddress` are required.
- Holder data is required.
- Wallet profiles, clusters, token intelligence, conviction, and personalities are module-loaded in parallel for standard/deep mode and may fail individually.
- Fast mode returns holders only and skips conviction.

### Analyze-token route to conviction route

`src/app/api/analyze-token/route.ts` is an orchestrator. In standard/deep mode it fetches:

- `/api/wallet-profiles`
- `/api/wallet-clusters`
- `/api/token-intelligence`
- `/api/conviction-engine`
- `/api/wallet-personalities`

The conviction URL passes `deep=true` only when analyze mode is `deep`.

Input shape to `/api/conviction-engine`:

- `chain`
- `tokenAddress`
- `tokenSymbol`
- `limit`
- `deep`
- `deepLimit`
- market fields from the token selection/search result

Output shape from `/api/conviction-engine`:

- `finalConvictionScore`
- `subScores`
- `aggregation`
- `explanation`
- `dataConfidence`
- `walletBreakdowns`
- `mapperCoverage`
- `mapperWarnings`
- `warnings`
- optional `deepBehavior`
- optional `deepBehaviorImpact`
- optional `bundleDetection`
- `status`
- `cache`

### Conviction route to mapper

`src/app/api/conviction-engine/route.ts` loads:

- `/api/holders` (required)
- `/api/wallet-profiles` (optional, capped at 10)
- `/api/wallet-clusters` (optional)
- search-param market data

It calls `mapLiveDataToConvictionInput` in `src/lib/conviction-live-mapper.ts`.

Mapper input shape:

- live holder rows
- live wallet profiles
- cluster summary
- market data
- token metadata

Mapper output shape:

- `ConvictionEngineInput`
- mapper warnings
- coverage info

Important mapper limitation:

- Standard mapping does not populate token-specific transfer in/out counts.
- The mapper always warns: token-specific transfer in/out counts are not mapped yet and deeper transaction indexing is required.
- `hasTokenTransferData` is `false` unless deep behavior later enriches the payload.

### Mapper to ConvictionEngineInput

`ConvictionEngineInput` contains:

- token identity: `chain`, `tokenAddress`, `tokenSymbol`
- `holders: ConvictionWalletInput[]`
- optional `market`
- optional `cluster`
- holder counts and ownership summaries
- optional `bundleRiskScore`
- optional `fundingSimilarityScore`
- optional `fakeDecentralizationRisk`

Each `ConvictionWalletInput` may include:

- rank, address, balance, ownership percent
- wallet age and activity
- recent tx counts
- days since last active
- token transfer counts
- token hold days
- deep bot/rotation/token conviction/behavior quality scores
- contract/exchange/fresh flags
- cluster and funding similarity scores

### Optional deep enrichment

If `/api/conviction-engine?deep=true` and `MORALIS_API_KEY` is available:

1. The route runs `analyzeDeepWalletBehaviorBatch` for top wallets.
2. It enriches matching holder inputs with:
   - `tokenTransferInCount`
   - `tokenTransferOutCount`
   - `tokenHoldDays`
   - `daysSinceLastActive`
   - `deepBotLikeActivityRisk`
   - `deepRotationBehaviorRisk`
   - `deepTokenSpecificConvictionScore`
   - `deepWalletBehaviorQualityScore`
3. It runs `analyzeFundingBundle`.
4. It adds:
   - `bundleRiskScore`
   - `fundingSimilarityScore`
   - `fakeDecentralizationRisk`
5. It reruns `calculateConvictionEngine` on the enriched input.

Caching:

- Conviction standard cache TTL is 300 seconds.
- Conviction deep cache TTL is 900 seconds.
- Deep behavior has its own cache key and 900-second TTL.

### Final response to terminal UI

The final conviction response is stored in `explainableConviction`.

It is consumed by:

- Overview score ring: `explainableConviction.finalConvictionScore`
- Overview score strip: `explainableConviction.subScores`
- Conviction Engine section
- Conviction History persistence
- Watchlist snapshots
- Signals
- Wallet Flows
- Insider Scan
- AI vs Human Arena

These consumers do not recalculate final conviction. They display, classify, summarize, or store it.

## 3. Current Final Formula

### Final weighted score

`calculateFinalConvictionScore(subscores)` calculates:

```text
final =
  holderIntegrity * 0.22 +
  walletQuality * 0.18 +
  behaviorStability * 0.18 +
  liquidityTrust * 0.15 +
  marketMomentum * 0.12 +
  riskProtection * 0.15
```

Then it applies severe-risk penalties and caps.

### Core subscores

`calculateConvictionEngine(input)` builds:

- `holderIntegrity`
- `walletQuality`
- `behaviorStability`
- `liquidityTrust`
- `marketMomentum`
- `riskProtection`
- `insiderRisk`
- `clusterRisk`
- `botActivityRisk`
- `rotationRisk`
- `freshWalletRisk`

Only the first six are directly weighted in the final formula. The risk subscores indirectly affect final conviction through `riskProtection`, severe-risk penalties, caps, explanation, signals, watchlist, and history.

### Holder Integrity

Calculated by `calculateHolderIntegrityScore`.

Inputs:

- top 10 ownership
- top 25 ownership
- fresh-wallet percent
- contract-holder percent
- exchange-holder percent
- average concentration risk

Formula behavior:

- Starts at 86.
- Penalizes top 10 ownership above 15%.
- Penalizes top 25 ownership above 35%.
- Penalizes fresh wallets, contracts, exchanges, and concentration.

### Wallet Quality

Calculated per wallet by `calculateWalletQualityScore`, then aggregated by `aggregateWalletScores`.

Per-wallet weights:

- maturity: 20%
- activity: 12%
- conviction behavior: 30%
- concentration protection: 14%
- dormancy protection: 10%
- bot protection: 10%
- cluster/funding protection: 4%

Caps/adjustments:

- Fresh wallet with concentration risk above 55 is capped at 38.
- Bot risk above 75 is capped at 42.
- Contract or exchange wallet is capped at 50.
- If `deepWalletBehaviorQualityScore` exists, it blends 58% deep score and 42% old score.

Aggregation:

- Top 10 wallet quality: 50%
- Top 25 wallet quality: 30%
- Top 100/all mapped wallet quality: 20%

### Behavior Stability

Calculated by `calculateBehaviorStabilityScore`.

Formula:

```text
weightedWalletQuality * 0.38 +
(100 - averageBotRisk) * 0.24 +
(100 - averageRotationRisk) * 0.20 +
(100 - averageDormancyRisk) * 0.18
```

Deep behavior can affect this through deep bot, rotation, transfer, hold, and behavior quality fields.

### Liquidity Trust

Calculated by `calculateLiquidityTrustScore`.

Inputs:

- liquidity USD
- market cap USD
- volume 24h USD

Behavior:

- If market data is missing, returns 35.
- Starts at 40.
- Adds log liquidity.
- Adds liquidity-to-market-cap ratio.
- Adds healthy volume/liquidity bonus.
- Penalizes low liquidity under $25,000.
- Penalizes high market cap with weak liquidity ratio.
- Penalizes extreme volume/liquidity ratio.

### Market Momentum

Calculated by `calculateMarketMomentumScore`.

Inputs:

- volume 24h USD
- volume change 24h
- price change 24h

Behavior:

- If market data is missing, returns 35.
- Starts at 42.
- Adds log volume.
- Adds/subtracts volume-change effect.
- Adds absolute price-change activity.
- Penalizes absolute price change above 70%.
- Penalizes price change below -35%.

### Insider Risk V1

Calculated by `calculateInsiderRiskScore`.

Inputs:

- top 10 ownership
- top 25 ownership
- clustered wallet percent
- elevated cluster count
- funding similarity
- bundle risk
- fake decentralization risk
- fresh-wallet percent
- contract-wallet percent
- average concentration risk

Formula:

```text
top10 * 1.2 +
top25 * 0.55 +
clusteredPercent * 0.32 +
elevatedClusters * 10 +
fundingSimilarity * 0.22 +
bundleRisk * 0.30 +
fakeDecentralizationRisk * 0.24 +
freshWalletPercent * 0.20 +
contractWalletPercent * 0.16 +
averageConcentrationRisk * 0.24
```

This risk is not directly weighted into final conviction. It affects final score through risk protection and the severe-risk penalty.

### Cluster Risk

Calculated by `calculateClusterRiskScore` and then raised by fake decentralization inside `calculateConvictionEngine`.

Inputs:

- cluster summary
- average concentration fallback
- fake decentralization risk

Behavior:

- If no cluster summary exists, fallback is `averageConcentrationRisk * 0.4`.
- Otherwise uses clustered wallet percent, average cluster confidence, elevated cluster count, and a coordination relationship boost.
- Final `clusterRisk` is max of calculated cluster risk and `fakeDecentralizationRisk * 0.85`.

### Risk Protection

Calculated by `calculateRiskProtectionScore`.

Risk inputs:

- insiderRisk: 28%
- clusterRisk: 18%
- average bot risk: 18%
- average rotation risk: 14%
- average concentration risk: 14%
- liquidity risk: 8%
- bundle risk: 12%

Important note: these weights sum to 1.12. Because the implementation uses a weighted average helper, the effective normalized weights are approximately:

- insiderRisk: 25.0%
- clusterRisk: 16.1%
- average bot risk: 16.1%
- average rotation risk: 12.5%
- average concentration risk: 12.5%
- liquidity risk: 7.1%
- bundle risk: 10.7%

Risk protection is:

```text
100 - weightedAverage(risk inputs)
```

### Severe-risk penalty

Inside `calculateFinalConvictionScore`, final score is reduced by 22 points if any of these is true:

- `insiderRisk > 85`
- `clusterRisk > 85`
- `botActivityRisk > 85`

### Final caps

Inside `calculateFinalConvictionScore`:

- If `liquidityTrust < 20`, final conviction is capped at 55.
- If `holderIntegrity < 20`, final conviction is capped at 45.

Inside `calculateConvictionEngine`, after `calculateFinalConvictionScore`:

- If `bundleRiskScore > 90`, final conviction is capped at 35.
- Else if `bundleRiskScore > 80`, final conviction is capped at 45.

### Confidence logic

`calculateDataConfidence` is separate from final score. It does not reduce `finalConvictionScore`.

Confidence inputs:

- holder count coverage: up to 38
- wallet-age coverage: up to 18
- transfer coverage: up to 18
- market data present: 14
- cluster data present: 12
- capped by `aggregation.dataCoverage + 35`

Warnings:

- fewer than 10 wallets analyzed
- market data unavailable
- cluster data unavailable
- transfer-level wallet data incomplete

If holders analyzed is 5 or fewer, confidence score is capped at 44.

Confidence labels:

- High: score >= 72
- Medium: score >= 45
- Low: below 45

## 4. Inputs Affecting Final Score

### Directly affects finalConvictionScore

These directly or indirectly change the six weighted final subscores:

- Holder rows
  - rank
  - address
  - ownership percentage
  - balance
  - contract flag
  - exchange-like labels
  - holder count summary
  - top 10 ownership
  - top 25 ownership
  - top 100 ownership
  - contract holder count
  - exchange holder count

- Wallet profile data
  - wallet age days
  - transaction count
  - recent activity count
  - activity velocity score
  - days since last active
  - native balance
  - behavior class
  - concentration risk score
  - is contract flag

- Market data
  - liquidity
  - market cap
  - volume 24h
  - price change 24h
  - volume change 24h

- Cluster summary
  - total analyzed wallets
  - clustered wallets
  - average cluster confidence
  - dominant relationship type
  - elevated risk cluster count

- Deep behavior when `deep=true`
  - transfer in count
  - transfer out count
  - estimated token hold days
  - days since last token activity
  - deep bot-like activity risk
  - deep rotation behavior risk
  - deep token-specific conviction score
  - deep wallet behavior quality score

- Funding and bundle detection when deep behavior succeeds
  - bundle risk score
  - funding similarity score
  - fake decentralization risk

### Risk inputs that affect final score indirectly

- insiderRisk affects risk protection and severe-risk penalty.
- clusterRisk affects risk protection and severe-risk penalty.
- botActivityRisk affects behavior stability, risk protection, and severe-risk penalty.
- rotationRisk affects behavior stability and risk protection.
- freshWalletRisk affects holder integrity and insider risk.
- bundleRisk affects insider risk, risk protection, and final bundle caps.
- fakeDecentralizationRisk affects insider risk and cluster risk.
- liquidity risk affects liquidity trust and risk protection.

### Does not affect finalConvictionScore

These may affect displays, summaries, signal classification, watchlist snapshots, or arena stance, but they do not feed the final formula:

- Wallet Reputation Engine V1 results
- Wallet Reputation summary
- Holder Intelligence Matrix V2
- Holder Intelligence summary
- Insider Mathematics V2 score and tier
- Wallet Flow Mathematics V2 results
- Token Flow Summary V2
- Signals board
- Watchlist local snapshots
- Conviction History persistence
- AI vs Human Arena entries
- Wallet personality previews, except where their data is used by UI-only V2 builders
- Bubble Intelligence graph

## 5. Inputs Only Displayed / Not Affecting Score

### Wallet Reputation Engine V1

Calculated client-side in `src/app/terminal/page.tsx` by `buildWalletReputationResults`, then summarized with `calculateTokenWalletReputationSummary`.

It is displayed in Conviction Engine, Insider Scan, holder/flow interpretations, and wallet detail surfaces.

It does not alter `ConvictionEngineInput` and is not sent to `/api/conviction-engine`.

### Holder Intelligence Matrix V2

Calculated client-side in `buildHolderIntelligenceMatrix` and `calculateHolderIntelligenceMatrix`.

It combines wallet rows, behavior profiles, cluster data, deep behavior, bundle membership, reputation, and personalities.

It is displayed in Insider Scan and passed to Conviction Engine explanatory UI. It is also used as an input to Insider Math V2 and Wallet Flow V2.

It does not alter final conviction.

### Insider Mathematics V2

Calculated client-side by `calculateInsiderRiskV2`.

It consumes:

- holder intelligence matrix
- holder intelligence summary
- old conviction risk subscores
- bundle detection
- cluster data
- token intelligence holder summary
- wallet reputation summary
- deep behavior

It does not replace `subScores.insiderRisk`, does not alter `riskProtection`, and does not cap final conviction.

### Wallet Flow Mathematics V2

Calculated client-side by `calculateWalletFlowV2` and `calculateTokenFlowSummaryV2`.

It consumes:

- deep behavior
- holder intelligence
- wallet reputation
- wallet profiles
- selected old conviction subscores
- ownership

It is used by Wallet Flows, Signals, and AI vs Human. It does not alter final conviction.

### Signals

Signals are generated client-side from already loaded state. They classify existing conviction, risk, flow, holder quality, liquidity, bundle/insider, deep behavior, and data confidence.

Signals do not feed back into the score.

### Watchlist

Watchlist stores local snapshots. It stores final conviction, selected old subscores, bundle risk, cluster risk, data confidence, and signal verdict.

It does not recalculate score and does not store V2 engine outputs.

### AI vs Human Arena

AI vs Human builds a stance from final conviction, risk protection, insider risk, bundle risk, cluster risk, rotation risk, and wallet-flow verdict.

It does not change score, API routes, or persisted conviction history.

## 6. New Engine Connection Status

### A. Wallet Reputation Engine V1

Where calculated:

- `src/lib/wallet-reputation.ts`
- called from `buildWalletReputationResults` in `src/app/terminal/page.tsx`

Where displayed/used:

- Conviction Engine explanatory panel
- Insider Scan
- Holder Intelligence Matrix V2 input
- Wallet Flow V2 input
- wallet drawer and holder-level surfaces

Does it affect final score?

- No.

How it should affect V2:

- Feed a new `walletQualityV2` subscore.
- Replace or calibrate the old `walletQuality` aggregation with reputation-weighted holder quality.
- Feed risk protection through average risk contribution and high-risk wallet share.
- Feed confidence through reputation coverage.

### B. Holder Intelligence Matrix V2

Where calculated:

- `src/lib/holder-intelligence.ts`
- called from `buildHolderIntelligenceMatrix` in `src/app/terminal/page.tsx`

Where displayed/used:

- Insider Scan
- Conviction Engine explanatory UI
- Insider Math V2 input
- Wallet Flow V2 input

Does it affect final score?

- No.

How it should affect V2:

- Become the main holder-quality layer.
- Feed a `holderQualityV2` or `holderBaseQuality` subscore from average holder score, support/risk distribution, dominant holder class, and confidence.
- Feed a `structuralRiskV2` subscore through average risk contribution, strong-risk holder count, cluster exposure, and concentration pressure.

### C. Insider Mathematics V2

Where calculated:

- `src/lib/insider-math.ts`
- called by `calculateInsiderRiskV2` in `src/app/terminal/page.tsx`

Where displayed/used:

- Insider Scan
- Conviction Engine explanatory UI

Does it affect final score?

- No.

Should it replace/adjust insiderRisk in V2?

- Yes. It should replace the old `calculateInsiderRiskScore` as the primary insider/structural-risk score once moved to server-side or shared formula execution.
- The old insider risk can remain as a fallback when V2 evidence is unavailable.
- V2 should retain explicit missing-evidence confidence rather than silently treating missing evidence as low risk.

### D. Wallet Flow Mathematics V2

Where calculated:

- `src/lib/wallet-flow-math.ts`
- called by `buildWalletFlowV2Results` and `calculateTokenFlowSummaryV2` in `src/app/terminal/page.tsx`

Where displayed/used:

- Wallet Flows
- Signals
- AI vs Human stance

Does it affect final score?

- No.

Should it affect behaviorStability / marketMomentum / riskProtection in V2?

- Yes.
- Accumulation dominance should support behavior stability and conviction behavior when confidence is adequate.
- Distribution dominance should reduce behavior stability and/or increase risk.
- Rotation heavy should reduce behavior stability and risk protection.
- Data-limited flow should lower confidence rather than automatically lowering score.
- Flow should not be mixed into market momentum unless market momentum is renamed; current market momentum is market-data-based, not wallet-flow-based.

### E. Funding & Bundle Detection V1

Where calculated:

- `src/lib/funding-bundle-detection.ts`
- called in `/api/conviction-engine` only in deep mode after deep behavior succeeds

Does it affect final score?

- Yes, but only when deep behavior path runs successfully.

How strongly?

- `bundleRiskScore` contributes to insider risk at weight 0.30.
- `fundingSimilarityScore` contributes to insider risk at weight 0.22.
- `fakeDecentralizationRisk` contributes to insider risk at weight 0.24.
- `bundleRiskScore` contributes to risk protection with configured weight 0.12, effectively about 10.7% of normalized risk-protection risk weight.
- `fakeDecentralizationRisk * 0.85` can raise `clusterRisk`.
- If `bundleRiskScore > 80`, final conviction is capped at 45.
- If `bundleRiskScore > 90`, final conviction is capped at 35.

Should it remain or be replaced by Insider Math V2 components?

- It should remain as an evidence provider.
- Insider Math V2 should own final structural-risk interpretation and caps.
- Bundle Detection V1 should become one input into V2 structural risk, not a separate one-off cap layer with duplicated bundle semantics.

### F. Deep Wallet Behavior V1

Where calculated:

- `src/lib/deep-wallet-behavior.ts`
- called by `/api/conviction-engine` when `deep=true`

Does `deep=true` affect final score?

- Yes, if `MORALIS_API_KEY` is available and deep behavior succeeds.

Which subscore changes?

- `walletQuality`, through:
  - `deepTokenSpecificConvictionScore`
  - `deepWalletBehaviorQualityScore`
  - token transfer in/out counts
  - token hold days
  - days since last activity
- `behaviorStability`, through changed wallet quality, average bot risk, average rotation risk, and dormancy risk.
- `riskProtection`, through bot risk, rotation risk, concentration risk, bundle risk, insider risk, and cluster risk.
- `insiderRisk`, through bundle/funding/fake decentralization and fresh/concentration interactions.
- `clusterRisk`, through fake decentralization.
- `finalConvictionScore`, through the weighted formula and bundle caps.

## 7. Score Consistency Issues

### Overview Wallet Quality vs Wallet Reputation

Overview and Conviction Engine show V1 `walletQuality`, while Wallet Reputation Engine V1 shows `reputationScore`, `convictionContribution`, and `riskContribution`.

These can disagree because they use different inputs and are calculated in different places:

- V1 wallet quality is server/API formula input.
- Wallet Reputation is client-side terminal intelligence.

### Insider Risk V1 vs Insider Risk V2

`subScores.insiderRisk` is the score that affects final conviction. `insiderRiskV2.insiderRiskScore` is richer but explanatory only.

The UI can show an advanced Insider Math V2 verdict while the final score is still capped/penalized by old V1 insider risk and bundle caps.

### Wallet Flow MVP/V2 vs Conviction Engine behavior

Wallet Flow V2 may classify accumulation, distribution, rotation, dormancy, and confidence using holder intelligence and reputation.

The final score only sees flow if deep behavior populated old fields before `calculateConvictionEngine`. The client-side V2 flow summary does not feed back into behavior stability or risk protection.

### Signals using mixed generations

Signals consume:

- final conviction and old subscores
- deep behavior summary
- bundle detection
- tokenFlowSummaryV2
- token intelligence and warnings

This means signals can include V2 flow while the final score remains V1.

### Watchlist stores old score fields

Watchlist snapshots store:

- final conviction
- data confidence
- holder integrity
- wallet quality
- risk protection
- insider risk
- bundle risk
- cluster risk
- latest signal verdict

It does not store:

- Wallet Reputation summary
- Holder Intelligence summary
- Insider Risk V2
- Wallet Flow V2

### AI vs Human uses final score plus V2 summaries

AI vs Human stance uses final conviction and old risk subscores, but it can also reference wallet flow verdict. This is useful for stance, but it can make the stance appear more V2-connected than the score itself is.

### Conviction History is V1-shaped

History stores final score, core old subscores, risk subscores, bundle risk, confidence, headline, and warnings. It does not persist V2 engine outputs.

## 8. Current Weaknesses

### V2 intelligence is not part of the score

The biggest weakness is conceptual drift: NovaOS now computes richer wallet, holder, insider, and flow intelligence, but final conviction still uses the original V1 subscore model.

### Insider Math V2 is explanatory only

Insider Math V2 has better structural reasoning:

- holder intelligence
- bundle evidence
- cluster evidence
- fresh ownership
- contract dominance
- relationship intensity
- evidence confidence

But final conviction uses V1 insider risk. This can underuse fresh high-ownership patterns, relationship intensity, and missing-evidence confidence.

### Wallet Flow V2 is explanatory only

Wallet Flow V2 can identify accumulation, distribution, rotation, dormancy, net flow, and confidence. Final conviction only gets flow through deep behavior's older fields, and only when deep mode succeeds.

### Reputation does not affect walletQuality

Wallet Reputation Engine V1 produces a direct reputation score and separate conviction/risk contributions, but V1 wallet quality ignores it. The old wallet-quality formula can therefore disagree with the reputation layer.

### Missing evidence reduces confidence but usually not score

This is mostly correct philosophically, but the current confidence is not strongly integrated into final interpretation. A low-confidence 70 can still look like a strong score unless the UI context is read carefully.

### Market momentum may be too price/volume sensitive

Market momentum adds absolute price movement and volume movement. It does not know whether activity is organic, coordinated, wash-like, or distribution-heavy. Wallet Flow V2 should eventually be the behavioral counterpart to market momentum.

### Liquidity trust is strong but isolated

Liquidity trust is deterministic and useful, but it does not combine with holder/flow risk except through a small liquidity-risk contribution inside risk protection.

### Bundle logic is split

Bundle evidence currently affects:

- V1 insider risk
- risk protection
- final hard caps
- Signals
- Insider Math V2
- Bubble Intelligence groups

This creates duplicate semantics. V2 should centralize bundle interpretation into structural risk while keeping the raw bundle detector as evidence.

### Deep mode creates two different scoring regimes

Standard mode and deep mode can produce materially different scores because deep mode populates transfer behavior and bundle fields. That is expected, but the system should make the distinction explicit in Formula V2: score version, evidence mode, and confidence should be first-class.

### V2 engines are client-side

The current V2 engines are imported into `page.tsx` and built from terminal state. They are not part of the API response that produces final conviction. Formula V2 will need to move the canonical V2 composition into a shared/server path or a new deterministic API layer.

## 9. Recommended Conviction Formula V2 Architecture

### Philosophy

Preserve the NovaOS chain:

```text
raw data
-> wallet intelligence
-> holder intelligence
-> insider math
-> flow math
-> token-level conviction
-> explainable final score
```

V2 should not simply add every new score into one average. It should create a clear hierarchy:

1. Normalize raw evidence.
2. Score wallets.
3. Score holders.
4. Score structural/insider risk.
5. Score wallet flow.
6. Score market/liquidity context.
7. Produce final conviction.
8. Produce confidence separately.
9. Apply severe caps only for high-confidence severe risks.

### Candidate V2 final formula

Candidate weighted formula:

```text
finalV2 =
  holderBaseQuality * 0.22 +
  walletReputationQuality * 0.16 +
  behaviorAndFlowStability * 0.18 +
  liquidityAndMarketTrust * 0.14 +
  structuralRiskProtection * 0.20 +
  evidenceConfidenceAdjustment * 0.10
```

Alternative without confidence as a weighted score:

```text
rawFinalV2 =
  holderBaseQuality * 0.24 +
  walletReputationQuality * 0.17 +
  behaviorAndFlowStability * 0.19 +
  liquidityAndMarketTrust * 0.15 +
  structuralRiskProtection * 0.25

finalV2 = applyCaps(rawFinalV2, severeRisks)
confidenceV2 = separate confidence output
```

Recommendation: use the second approach. Confidence should mostly affect confidence, warnings, and cap eligibility, not become a hidden score penalty. Missing evidence should not automatically become negative evidence.

### New subscore architecture

#### 1. holderBaseQuality

Feeds from:

- Holder Intelligence Matrix V2
- holder summary
- concentration
- support/risk holder distribution
- holder confidence

Replaces:

- most of V1 `holderIntegrity`

Keep from V1:

- top 10/top 25 concentration checks
- contract/exchange holder context

#### 2. walletReputationQuality

Feeds from:

- Wallet Reputation Engine V1
- average reputation
- average conviction contribution
- average risk contribution inverted
- high-risk wallet share
- unknown wallet share

Replaces/updates:

- V1 `walletQuality`

Keep from V1:

- maturity/activity/dormancy/bot/rotation primitives as fallback evidence when reputation is unavailable

#### 3. behaviorAndFlowStability

Feeds from:

- Deep Wallet Behavior V1
- Wallet Flow Mathematics V2
- rotation pressure
- dormancy pressure
- distribution pressure
- accumulation pressure
- flow confidence

Replaces/updates:

- V1 `behaviorStability`

Keep from V1:

- bot risk
- rotation risk
- dormancy risk

#### 4. liquidityAndMarketTrust

Feeds from:

- V1 liquidity trust
- V1 market momentum
- market data availability
- liquidity/market cap ratio
- volume/liquidity sanity

Replaces:

- separate V1 `liquidityTrust` and `marketMomentum` in final score

Keep:

- liquidity hard-cap logic
- extreme volume/liquidity warning

#### 5. structuralRiskProtection

Feeds from:

- Insider Mathematics V2
- Funding & Bundle Detection V1 as evidence
- cluster data
- fake decentralization risk
- fresh high-ownership patterns
- relationship intensity
- contract dominance
- V1 insider/cluster fallback

Replaces:

- V1 `riskProtection`
- V1 `insiderRisk` as primary structural risk

Keep:

- V1 severe-risk concepts as fallback or compatibility fields

### V2 engine feed map

- Wallet Reputation Engine V1 -> `walletReputationQuality`, holder intelligence inputs, flow inputs, confidence coverage
- Holder Intelligence Matrix V2 -> `holderBaseQuality`, `structuralRiskProtection`, Insider Math V2
- Insider Mathematics V2 -> primary structural risk, final caps, warnings, explainability
- Wallet Flow Mathematics V2 -> `behaviorAndFlowStability`, stance summaries, distribution/rotation caps
- Funding & Bundle Detection V1 -> evidence for Insider Math V2 and structural risk caps
- Deep Wallet Behavior V1 -> wallet reputation, holder intelligence, wallet flow, fallback old behavior signals
- Signals -> output/interpretation only
- Watchlist -> storage only
- History -> persistence only
- AI vs Human -> stance consumer only

### Severe risk caps to keep

Keep these concepts:

- very low liquidity should cap conviction
- very low holder integrity/holder quality should cap conviction
- critical insider/structural risk should reduce or cap conviction
- high-confidence bundle/fake decentralization should cap conviction
- extreme bot/rotation risk should reduce conviction

### New caps to add

Suggested V2 caps:

- `insiderRiskV2 >= 90` and confidence >= 55: cap final at 35.
- `insiderRiskV2 >= 80` and confidence >= 55: cap final at 45.
- `bundleStructureScore >= 85` and evidence confidence >= 50: cap final at 40.
- `freshOwnershipScore >= 80` with top-holder concentration pressure >= 65: cap final at 45.
- `distributionPressure >= 75` and flow confidence >= 55: cap final at 55 unless accumulation pressure is also high and rotation is low.
- `rotationPressure >= 80` and flow confidence >= 55: cap final at 50.
- `liquidityTrust < 20`: keep cap at 55, possibly lower to 50 if market cap is high and liquidity ratio is weak.
- `holderBaseQuality < 25`: cap final at 45.
- `walletReputationQuality < 30` with high-risk wallet share > 40%: cap final at 50.

### Confidence V2

Confidence should be calculated from evidence coverage, not from bullish/bearish direction.

Inputs:

- holder coverage
- wallet profile coverage
- deep behavior coverage
- reputation coverage
- holder intelligence coverage
- cluster coverage
- bundle evidence coverage
- market data coverage
- flow confidence
- insider evidence confidence

Missing evidence should:

- reduce confidence
- produce explicit warnings
- prevent high-confidence caps unless severe raw risk is directly observed
- avoid being treated as proof of safety

Missing evidence should not:

- automatically zero a score
- automatically imply risk
- silently inflate final conviction

### API shape recommendation

Add a Formula V2 result shape eventually:

```ts
type ConvictionFormulaV2Result = {
  finalConvictionScoreV2: number;
  formulaVersion: "v2";
  evidenceMode: "standard" | "deep" | "partial";
  subScores: {
    holderBaseQuality: number;
    walletReputationQuality: number;
    behaviorAndFlowStability: number;
    liquidityAndMarketTrust: number;
    structuralRiskProtection: number;
  };
  riskScores: {
    insiderRiskV2: number;
    bundleStructureScore: number;
    flowDistributionRisk: number;
    flowRotationRisk: number;
    freshOwnershipRisk: number;
  };
  confidence: {
    score: number;
    label: "Low" | "Medium" | "High";
    missingEvidence: string[];
    warnings: string[];
  };
  capsApplied: Array<{
    id: string;
    before: number;
    after: number;
    reason: string;
  }>;
  explanation: {
    headline: string;
    topPositiveDrivers: string[];
    topRiskDrivers: string[];
    methodology: string;
  };
};
```

## 10. Safe Implementation Plan for V2

1. Add a pure Formula V2 module.
   - Suggested file: `src/lib/conviction-formula-v2.ts`.
   - It should accept canonical V2 inputs and return a deterministic result.
   - Do not modify V1 formulas initially.

2. Create a V2 input builder.
   - It should compose existing V1 API result, wallet reputation, holder intelligence, insider math, wallet flow, deep behavior, bundle detection, cluster data, and market data.
   - Prefer shared/server-compatible functions rather than page-only state.

3. Add test fixtures before UI wiring.
   - Standard mode no-deep case.
   - Deep accumulation case.
   - Deep distribution case.
   - Fresh high-ownership bundle case.
   - Low liquidity case.
   - Missing evidence case.

4. Return V2 alongside V1, not instead of V1.
   - Add `formulaV2` to the conviction API response once stable.
   - Keep `finalConvictionScore` as V1 until migration is explicitly chosen.

5. Add UI comparison.
   - Show V1 final and V2 candidate side by side in a developer/audit panel first.
   - Show caps applied and evidence confidence.

6. Migrate consumers intentionally.
   - Overview should move last.
   - Signals can consume V2 earlier because they already synthesize multiple layers.
   - Watchlist/history should include formula version.
   - AI vs Human should use the active formula version explicitly.

7. Flip the canonical score only after backtesting.
   - Compare V1 and V2 across synthetic scenarios and live examples.
   - Validate that high-risk bundle/fake decentralization cases are capped.
   - Validate that low evidence does not create fake certainty.

8. Keep V1 compatibility.
   - Keep old fields in API response for existing UI sections.
   - Add migration notes for history/watchlist local storage.

## Audit Conclusion

The current final conviction score is produced by Conviction Engine V1. Deep Wallet Behavior V1 and Funding & Bundle Detection V1 can affect it only through the deep path. The richer V2 engines are currently strong explanatory and UI intelligence layers, but they are not connected to the canonical final score.

Conviction Formula V2 should make the V2 engines first-class formula inputs, centralize structural risk through Insider Math V2, convert Wallet Flow V2 into behavior/flow stability, use Wallet Reputation for wallet quality, and keep confidence separate from score. The safest next step is to build V2 as a parallel deterministic module and compare it against V1 before changing the production final score.
