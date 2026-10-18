# Stephen’s Weather & Marine Observatory + Ibiza Sea School Weather & Maritime Desk

Two distinct public static views are maintained in the existing `st44jdh22/weather-observatory` repository:

- `/index.html` — Stephen’s personal Weather & Marine Observatory, including its barograph and forecast displays.
- `/ibiza-sea-school/index.html` — Ibiza Sea School Captain's Weather & Maritime Desk, with its own assets, manifest and service worker.
- `/cloudflare/` — separately controlled Cloudflare Worker source, Wrangler configuration, tests and deployment workflows.

Current sites:
- Stephen's Observatory: https://st44jdh22.github.io/weather-observatory/
- Ibiza Sea School maritime hub: https://st44jdh22.github.io/weather-observatory/ibiza-sea-school/

## Legacy ARA path retirement — 18 October 2026

With Stephen's approval, the obsolete `/ara/` directory and its previous redirect/cache-cleanup service worker are retired. No redirect is required for old `/ara/` links. The link in Stephen's Observatory is now directly to Ibiza Sea School. Earlier README descriptions of the retired ARA standalone page are superseded.

The existing Ibiza Sea School website and its service worker remain in place; the independently deployed Cloudflare Worker, GitHub Actions deployment workflow and Wrangler settings are separate and untouched by this static-site cleanup. Do not delete `/cloudflare/` simply because the old `/ara/` Pages folder was removed.

Git history preserves previous revisions. This is not a purge of historical source or cached content already stored on visitors' devices.

Weather information and site displays are decision support and do not replace official marine warnings, charts or operational judgement.
