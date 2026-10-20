# Ibiza Sea School Weather Desk: navigation and Windguru staging record
Date: 20 October 2026 (UK). Authority: Stephen Hullock. Engineering: Zara, with cloud oversight by Lindsey.

## Approved changes and requested experience
- Add a dropdown at the top of the existing Weather Desk to jump to AEMET, observations, current forecast, captain summary, Windy point forecast/maps, three-day forecast, webcams, barograph, hourly detail, model comparison, passage reporting and source links.
- Add a verified MarineTraffic official-site external link. Do not embed/copy MarineTraffic AIS feed without licensing.
- Preserve existing website/data/passage functions and mobile behaviour. Prototype and review before production change.

## Windguru API status
- Vaclav authorised a private one-yacht A58 dashboard with model comparisons and source attribution; this is NOT broad public forecasting or general fleet redistribution permission.
- Stephen created the Developer key "A58 Weather Desk — Development" on 19 October 2026 and retains the full secret. Never put it in chat, GitHub or browser assets.
- Developer quota screenshot: 100 distinct locations/day, 300 per month and 5000 cost units/day. Developer data are synthetic, not real marine forecasts.
- Draft PR #25: https://github.com/st44jdh22/weather-observatory/pull/25 ; provides portable comparison algorithms, a test-only UI and model agreement heuristics; CI 23 tests passed. It is not connected to Windguru yet.
- Follow-up: verify beta API schema and model inventory, build server-side credential-protected fetch with provenance/caching/limits, preserve attribution, then independently verify returned test models and timestamps.

## Private staging release gates
Owner approval allows isolated staging only after **zero additional charges** and appropriate private access controls have been independently verified.
1. New isolated runtime and hostname, access-controlled at the edge, no public indexing; no mixing with actual production services.
2. Synthetic fixtures only: no real captain/owner identity documents, operational passages or customer records.
3. Keep existing Ibiza Sea School GitHub Pages and Cloudflare deployments untouched.
4. Cloudflare hosting access/cost entitlement cannot currently be independently confirmed with available tools. The existing Railway project is the unrelated Hey Sophie/Post Office pilot and must not be reused.
5. No API key in source; provision future server secret only via approved provider UI after infrastructure review.
6. Require authenticated denial check, source and destination readback, explicit hostname/commit/cost/rollback and acceptance tests prior to calling staging HOSTED VERIFIED.
7. Current status: **PREPARED / NOT DEPLOYED**. No hosting, API calls, billed plans or domain changes performed.

## Acceptance checks on navigation PR
Every dropdown value maps to exactly one existing section ID, selects and scrolls with reduced-motion support; MarineTraffic opens an external official link; existing model logic not modified; independent mobile visual check and final owner approval before merge.
