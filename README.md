# Stephen’s Weather & Marine Observatory + ARA Weather Desk

Integrated static website package based on **the actual `index(1).html` uploaded by Stephen on 16 October 2026**. The exact original upload is saved separately as `Stephen_Observatory_Original_Backup.html`, outside the deployment folder for rollback.

## One website / two views

- `/index.html` — Stephen’s personal working observatory with the original SVG fixed-scale barograph preserved.
- `/ara/index.html` — ARA Weather Desk (V2 working prototype), preserving its assets and PWA shell.

The two top navigation links change URL **within the same tab**, and remain under **one GitHub Pages site**. Example addresses when published to your existing repository:

- Personal: `https://st44jdh22.github.io/weather-observatory/`
- ARA: `https://st44jdh22.github.io/weather-observatory/ara/`

**Do not create a second repository.** Both are views within the existing `weather-observatory` project. Opening the ARA view doesn't log anyone in, and the captain checklist is an unverified draft.

## Personal observatory update

- Original HTML, CSS theme, HTML/SVG recording barograph and data request functions retained and incrementally amended.
- Correct name **Stephen’s Weather & Marine Observatory**.
- Permanent no-search home and Ibiza shortcuts; browser-stored additional favourites.
- UK official Shipping Forecast panel placed above the barograph; direct official link also near the top.
- Experimental **rules-based** weather interpretation with model comparison and optional offshore marine data near Ibiza. This is **not yet a generative-AI briefing**.
- The Shipping Forecast remains manually imported by default. `shipping-forecast.json` is an **optional future** verified feed. Missing, stale or invalid feed does not imply no gales. There is deliberately no fictitious live bulletin in this package.

## Publishing

On GitHub, back up the old `index.html`, then upload the new `index.html` and the `ara/` folder contents to **the existing repository root**. Ensure folder paths are preserved. The ARA PWA service worker is scoped to `/ara/` and does not control the personal page. The backup file is available separately and is **not** part of the deployment bundle.

No files have been published to GitHub by this package. After publishing, test both addresses in Safari and check actual Open-Meteo responses. If automatic sources fail, review the API errors and the terms of the provider before operational use. Open-Meteo's public free API is not approved for commercial use as-is.

The ARA page contains an optional Windy embed loaded on request; third-party frames and maps can change their terms or functionality. The ARA page requires a secure HTTPS origin for PWA installation.
