# Windguru Forecast Model Agreement Lab — private marine operations

## Authority and boundaries

- **Owner:** Ibiza Sea School / private A58 maritime operations. Engineering: Zara and delegated Codex.
- **Provider:** Windguru API (public beta); Vaclav's written reply to Stephen on 18 October 2026 permits *one private yacht* internal dashboard, including commercial internal use; not forecast data resale/distribution or a product principally providing forecasts.
- **Website integration:** Do not put the paid Windguru feed in the public RYA training site or its publicly visible Weather Desk without **fresh licensing clarification from Windguru**.
- **Attribution:** Preserve the exact meta.attribution value returned by the live Windguru response, including "Powered by Windguru" and model-source labels.
- **Credential:** Stephen created *A58 Weather Desk — Development*, a Developer key (test-data-only), on 19 October 2026. He holds the secret. The secret is **not in GitHub, chat, docs or app assets**. Do not ask for it in chat. Developer data are **simulated, not navigational forecasts**.
- **Developer quota observed in account screenshot:** 100 distinct locations/day, **300 distinct locations/month** and 5,000 cost units/day, *not 3,000 locations/month*. Confirm with pricing docs before paid activation.
- Windguru indicated the €49/year Project plan is likely sufficient. No payment authorised/executed, no hosting or real API key installed.

## Current prepared code

- public/weather-models/index.html: responsive comparison lab with location/time selectors, wind-speed and direction dispersion, wind/gust/wave/wave-period columns, model issue times and simulated-data banner.
- public/weather-models/model-agreement.js: unit/pure forecast comparison engine designed to survive the larger Ibiza Sea School site redesign.
- public/weather-models/synthetic-fixture.js: fake forecasts tagged SIMULATED_FIXTURE_NOT_WINDGURU; **not Windguru data**.
- test/windguru-model-agreement.test.js: exact time/spot matching, duplicate resolution by latest run, wraparound at N/359°, N-vs-S disagreement, near-calm handling, malformed data and synthetic-only safety.

## Normalised model forecast contract

Each forecast row represents a **single model, one valid hour, one spot**:
model, spot, valid_time (ISO UTC), run_time (ISO UTC), wind_kn, wind_from_deg (degrees FROM which wind blows), gust_kn, and optional wave_m, swell_m, wave_period_s. Proposed future provider adapter must record source metadata and licensing attribution; never infer unsupported fields or fill model gaps with invented numbers.

Model forecasts **must not** compare unlike valid times or positions. For duplicate model/valid-time records, choose the most recently issued run. Display the forecast valid time in Europe/Madrid, separately from the run issue time.

## Model Agreement (NOT a probability)

The prototype's transparent diagnostic defines a "similar" pair when:
- wind speeds differ by **at most 5 knots**, and
- wind directions (circular degrees) differ by **at most 45 degrees**.
When both model forecasts have wind below 4 kn, direction is excluded as less meaningful.
- Strong agreement: at least 80% of comparable pairs meet those criteria.
- Mixed agreement: 50% to below 80%.
- Low agreement: below 50%.

The "similar pair percentage" is **only an index of closeness between forecasts**. It is not the chance the forecast is correct, a probabilistic confidence interval, or empirically established model skill. Forecast models can share data and systematic biases; they are not independent votes.

Show individual model results, min-max wind/gust/wave, maximum angular separation and timestamps. The user may see 8 kn N, 3 kn S and 9 kn NNW side-by-side. AEMET remains the **official bulletin/warning layer**, not overwritten by model consensus.

## Incomplete prerequisites for live connection (open)

1. Retrieve complete Windguru public-beta request and response schema from provider docs **without sharing credentials**, including supported models, coordinate endpoints, per-model time series, attribution and quotas. API documentation was not fully machine-readable during this engineering pass, so **no Windguru endpoint, authentication header or response schema is invented**. An HTML mock is not a live integration.
2. Confirm Windguru private-site licence scope for deployment to A58 authorised crew; ask for revised written permission if the system later serves a larger fleet, public audience or forecast-led commercial service.
3. Following explicit approval for isolated private staging and secret placement, have Stephen save the **Developer** key directly into an approved server-side secret store using the hosting provider UI. Never put it in GitHub, Pages, browser, scripts, logs or chats.
4. Implement a **server-side provider adapter** with schema validation, rate/quota limits, model/spot allowlist, attribution retention, fetch timeout/caching, error handling and fail-closed no-fresh-data states.
5. Test using test-only provider data; conspicuously display DEVELOPER TEST DATA — NOT REAL WEATHER. Verify returned model values and issuance times and compare with account quota.
6. Only following approved Windguru Project subscription, licence check and release review may the app show real data. The public Weather Desk must **never silently substitute synthetic forecasts**.

**Deployment status:** development PR only; no provider connection, domain route, public website change, paid plan, database, or hosted endpoint.
